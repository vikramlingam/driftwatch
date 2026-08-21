import sqlite3
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse


def verify_local_access(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if client_ip not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(status_code=403, detail="DriftWatch API access is restricted to localhost.")


from .audit import audit_project_file, create_code_fix
from .config import settings
from .db import Database
from .github_client import GitHubClient, parse_github_repo
from .impact import scan_directory_for_impact, scan_file_for_impacts
from .llm_reviewer import review_code_with_llm
from .models import (
    CodebaseImpactReport,
    CreatePRRequest,
    CreatePRResponse,
    DocUpdateItem,
    GitHubConfigStatus,
    GitHubScanRequest,
    GitHubScanResponse,
    LLMReviewRequest,
    LLMReviewResponse,
    ProjectAuditRequest,
    ScrapeRequest,
    SelfHealingLoopRequest,
    SelfHealingLoopResponse,
    WatcherConfigRequest,
    WatcherStatusResponse,
)
from .policy import validate_public_http_url, validate_public_http_urls
from .scraper import fix_scraper_with_ai, run_closed_loop_self_healing, run_pipeline
from .watcher import watcher_instance

AUTHORIZED_PATCHES: dict[str, dict[str, str]] = {}

db = Database(settings.db_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load persisted custom target URLs
    try:
        custom_targets = db.get_custom_targets()
        for url in custom_targets:
            try:
                safe_url = validate_public_http_url(url)
            except ValueError:
                continue
            settings.add_target_url(safe_url)
            watcher_instance.add_target(safe_url)
    except (OSError, sqlite3.Error) as exc:
        watcher_instance.log(f"Startup note: unable to load persisted targets ({exc!s})")

    # Do not start a paid/network collection during application startup. A
    # multi-URL Bright Data batch can take several minutes and would block the
    # API lifespan, making the dashboard appear to hang after the database is
    # cleared. Collections are started explicitly through /api/scrape.
    yield


app = FastAPI(
    title="DriftWatch",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_local_access)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.frontend_origins.split(",") if x.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ready",
        "database_records": db.count(),
        "active_scraper": bool(settings.bright_data_api_token and settings.bright_data_collector_id),
        "bright_data_configured": bool(settings.bright_data_api_token and settings.bright_data_collector_id),
        "collector_id": settings.bright_data_collector_id,
        "db_path": str(settings.db_path),
        "watcher_running": watcher_instance.is_running,
    }


@app.get("/api/counts")
def counts() -> dict:
    return {
        "total": db.count(),
        "breakdown": db.counts(),
    }


@app.post("/api/clear-db")
def clear_db() -> dict:
    db.clear()
    return {
        "status": "cleared",
        "total_records": db.count(),
    }


_background_scan_status: dict[str, dict] = {}


async def _run_scan_background(job_key: str, urls: list[str], collector_id: str | None, force_engine: str):
    """Run the scrape pipeline in the background and store the result."""
    _background_scan_status[job_key] = {"status": "running", "message": "Scan in progress..."}
    try:
        result = await run_pipeline(urls, collector_id=collector_id, force_engine=force_engine)
        _background_scan_status[job_key] = {
            "status": "done",
            "message": f"Saved {result.valid_items_saved} records ({result.quarantined_items_count} quarantined)",
            "result": result.model_dump(mode="json"),
        }
    except (httpx.HTTPError, OSError, RuntimeError, TimeoutError, ValueError, TypeError, sqlite3.Error) as exc:
        _background_scan_status[job_key] = {"status": "error", "message": str(exc)}


@app.post("/api/scrape")
async def scrape(request: ScrapeRequest):
    import asyncio

    urls = [str(u) for u in request.urls] if request.urls else settings.target_urls
    try:
        from .policy import validate_public_http_urls as _val
        urls = _val(urls)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job_key = f"scan_{uuid.uuid4().hex[:8]}"
    asyncio.create_task(_run_scan_background(job_key, urls, request.collector_id, request.force_engine))
    return {
        "batch_id": job_key,
        "urls_checked": urls,
        "total_items_found": 0,
        "valid_items_saved": 0,
        "quarantined_items_count": 0,
        "quarantined_errors": [],
        "pipeline_errors": [],
        "time_taken_seconds": 0,
        "execution_engine": "bright_data_dca",
        "bright_data_job_id": None,
        "collector_id_used": request.collector_id or settings.bright_data_collector_id,
        "telemetry_logs": [f"Scan launched in background. Job: {job_key}. Records will appear as they are saved."],
        "status": "scanning",
        "job_key": job_key,
    }


@app.get("/api/scrape/status/{job_key}")
def scrape_status(job_key: str):
    return _background_scan_status.get(job_key, {"status": "unknown", "message": "Job not found"})


@app.post("/api/targets/add", dependencies=[Depends(verify_local_access)])
async def add_target_feed(payload: dict):
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing required 'url' parameter.")
    try:
        url = validate_public_http_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    settings.add_target_url(url)
    db.add_custom_target(url, ecosystem="Custom")
    watcher_instance.add_target(url)
    scrape_res = await run_pipeline([url])
    return {
        "status": "added",
        "target_url": url,
        "valid_items_saved": scrape_res.valid_items_saved,
        "monitored_targets_count": len(watcher_instance.target_urls),
    }


@app.post("/api/self-heal-loop", response_model=SelfHealingLoopResponse, dependencies=[Depends(verify_local_access)])
async def self_heal_loop(request: SelfHealingLoopRequest):
    try:
        target_url = validate_public_http_url(request.target_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await run_closed_loop_self_healing(
        collector_id=request.collector_id,
        target_url=target_url,
        issue_description=request.get_description(),
        auto_approve=request.get_auto_approve(),
        re_run_after_approval=request.re_run_after_approval,
    )


@app.get("/api/updates")
def updates(ecosystem: str | None = None, limit: int = 500):
    return db.latest(ecosystem=ecosystem, limit=limit)


@app.get("/api/search")
def search(q: str = "", ecosystem: str | None = None, limit: int = 500):
    if not q.strip():
        return db.latest(ecosystem=ecosystem, limit=limit)
    return db.search(q.strip(), ecosystem=ecosystem, limit=limit)


@app.post("/api/check-code")
def check_code(request: ProjectAuditRequest):
    return audit_project_file(request.file_content, request.file_type, db)


# Innovation 1: Local Code Impact Mapper
@app.post("/api/impact/scan-directory", response_model=CodebaseImpactReport)
def impact_directory(payload: dict):
    directory_path = payload.get("directory_path", ".")
    from pathlib import Path
    resolved = Path(directory_path).expanduser().resolve()
    if not resolved.exists() or not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory path '{directory_path}' does not exist or is not a valid directory.")
    return scan_directory_for_impact(str(resolved), db)


@app.post("/api/impact/scan-snippet")
def impact_snippet(payload: dict):
    filename = payload.get("filename", "app.py")
    content = payload.get("content", "")
    advisories = [DocUpdateItem.model_validate(x) for x in db.latest(limit=500)]
    matches = scan_file_for_impacts(filename, content, advisories)
    return {
        "file_path": filename,
        "impact_count": len(matches),
        "matches": matches,
    }


# Innovation 3: Continuous Drift Watcher Endpoints
@app.get("/api/watcher/status", response_model=WatcherStatusResponse)
def watcher_status():
    return watcher_instance.status()


@app.post("/api/watcher/start", response_model=WatcherStatusResponse, dependencies=[Depends(verify_local_access)])
async def watcher_start(config: WatcherConfigRequest):
    if config.target_urls:
        try:
            config.target_urls = validate_public_http_urls(config.target_urls)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    await watcher_instance.start(config)
    return watcher_instance.status()


@app.post("/api/watcher/stop", response_model=WatcherStatusResponse, dependencies=[Depends(verify_local_access)])
def watcher_stop():
    watcher_instance.stop()
    return watcher_instance.status()


@app.get("/api/watcher/pending-repairs")
def watcher_pending_repairs():
    return watcher_instance.pending_repairs


@app.post("/api/watcher/approve-repair/{repair_id}", dependencies=[Depends(verify_local_access)])
async def watcher_approve_repair(repair_id: str):
    approved = await watcher_instance.approve_repair(repair_id)
    if not approved:
        raise HTTPException(status_code=404, detail=f"Pending repair with id '{repair_id}' not found.")
    return approved


@app.post("/api/watcher/reject-repair/{repair_id}", dependencies=[Depends(verify_local_access)])
def watcher_reject_repair(repair_id: str):
    rejected = watcher_instance.reject_repair(repair_id)
    if not rejected:
        raise HTTPException(status_code=404, detail=f"Pending repair with id '{repair_id}' not found.")
    return rejected


@app.get("/api/download-fix", response_class=PlainTextResponse)
def download_fix(ecosystem: str = "custom", old_code: str = "", new_code: str = "", filename: str = "app.py"):
    return create_code_fix(ecosystem, old_code, new_code, sample_filename=filename)


@app.post("/api/fix-scraper")
async def fix_scraper(payload: dict):
    collector_id = payload.get("collector_id") or settings.bright_data_collector_id
    if not collector_id:
        raise HTTPException(status_code=400, detail="No collector ID provided or found in environment (.env).")
    issue_desc = payload.get("issue_description", "The documentation webpage layout has updated selectors.")
    return await fix_scraper_with_ai(collector_id, issue_desc)


# Innovation: GitHub AI Remediation & PR Studio Endpoints
@app.get("/api/github/config-status", response_model=GitHubConfigStatus)
def github_config_status():
    return GitHubConfigStatus(
        openrouter_configured=bool(settings.openrouter_api_key),
        openrouter_model=settings.openrouter_model,
        github_token_configured=bool(settings.github_token),
        github_username=settings.github_username,
    )


@app.get("/api/github/config", response_model=GitHubConfigStatus)
def github_config_alias():
    return github_config_status()


@app.post("/api/github/scan", response_model=GitHubScanResponse)
async def github_scan(request: GitHubScanRequest):
    try:
        owner, repo = parse_github_repo(request.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    client = GitHubClient(token=request.github_token or settings.github_token)
    try:
        found_files, default_branch = await client.scan_repo_manifests_and_code(owner, repo, branch=request.branch)
    except (httpx.HTTPError, OSError, RuntimeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Failed to scan GitHub repository: {e!s}")

    advisories = [DocUpdateItem.model_validate(x) for x in db.latest(limit=200)]
    all_matches = []
    advisories_hit = set()
    manifests_found = []

    for file_path, content in found_files.items():
        if any(file_path.endswith(m) for m in ["requirements.txt", "package.json", "pyproject.toml", "mcp_config.json", "README.md"]):
            manifests_found.append(file_path)
        file_matches = scan_file_for_impacts(file_path, content, advisories)
        if file_matches:
            all_matches.extend(file_matches)
            for m in file_matches:
                advisories_hit.add(f"{m.advisory_title} ({m.urgency})")

    return GitHubScanResponse(
        repo_name=f"{owner}/{repo}",
        default_branch=default_branch,
        manifests_found=manifests_found,
        scanned_files_count=len(found_files),
        impact_matches=all_matches,
        advisories_detected=list(advisories_hit),
        openrouter_configured=bool(settings.openrouter_api_key),
        github_token_configured=bool(client.token),
    )


@app.post("/api/github/review", response_model=LLMReviewResponse)
async def github_review(request: LLMReviewRequest):
    file_content = request.file_content
    # Automatically fetch full file content from GitHub to ensure complete in-place patching
    if request.repo_name and request.file_path:
        try:
            owner, repo = parse_github_repo(request.repo_name)
            client = GitHubClient(token=request.github_token or settings.github_token)
            full_content, _ = await client.fetch_file_content(owner, repo, request.file_path)
            if full_content and len(full_content.strip()) > len(file_content.strip()):
                file_content = full_content
        except (httpx.HTTPError, OSError, RuntimeError, ValueError):
            pass  # Fall back to provided content

    updated_req = request.model_copy(update={"file_content": file_content})
    res = await review_code_with_llm(updated_req)
    import uuid
    patch_id = f"patch_{uuid.uuid4().hex[:12]}"
    res.patch_id = patch_id
    AUTHORIZED_PATCHES[patch_id] = {
        "file_path": request.file_path,
        "patched_code": res.patched_code,
    }
    return res


@app.post("/api/github/create-pr", response_model=CreatePRResponse, dependencies=[Depends(verify_local_access)])
async def github_create_pr(request: CreatePRRequest):
    try:
        owner, repo = parse_github_repo(request.repo_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if request.execution_mode == "rule_based_fallback" and not request.fallback_acknowledged:
        raise HTTPException(
            status_code=403, 
            detail="Fallback acknowledgment is required to merge heuristic rule-based patches."
        )

    if not request.patch_id or request.patch_id not in AUTHORIZED_PATCHES:
        raise HTTPException(status_code=403, detail="Invalid or expired patch ID. Patches must be generated by the review endpoint.")
        
    auth_patch = AUTHORIZED_PATCHES[request.patch_id]
    if request.file_path != auth_patch["file_path"] or request.patched_code != auth_patch["patched_code"]:
        raise HTTPException(status_code=403, detail="Patch content or file path mismatch. Cannot submit arbitrary code.")

    token = request.github_token_override or settings.github_token
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Missing GitHub Token. Please set GITHUB_TOKEN in your .env or provide it in the input field.",
        )

    client = GitHubClient(token=token)
    try:
        res = await client.create_pull_request(
            owner=owner,
            repo=repo,
            file_path=request.file_path,
            patched_code=request.patched_code,
            pr_title=request.pr_title,
            pr_body=request.pr_body,
            base_branch=request.base_branch,
            custom_branch=request.branch_name,
        )
        return CreatePRResponse.model_validate(res)
    except (httpx.HTTPError, OSError, RuntimeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Failed to create Pull Request on GitHub: {e!s}")
