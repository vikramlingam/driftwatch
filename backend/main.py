"""FastAPI application for DriftWatch."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from .audit import audit_project_file, create_code_fix
from .config import settings
from .db import Database
from .impact import scan_directory_for_impact, scan_file_for_impacts
from .models import (
    CodebaseImpactReport,
    DocUpdateItem,
    ProjectAuditRequest,
    ScrapePipelineResult,
    ScrapeRequest,
    SelfHealingLoopRequest,
    SelfHealingLoopResponse,
    WatcherConfigRequest,
    WatcherStatusResponse,
)
from .scraper import fix_scraper_with_ai, run_closed_loop_self_healing, run_pipeline
from .watcher import watcher_instance

db = Database(settings.db_path)
app = FastAPI(title="DriftWatch", version="1.0.0")

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
        "active_scraper": bool(settings.bright_data_collector_id),
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


@app.post("/api/scrape", response_model=ScrapePipelineResult)
async def scrape(request: ScrapeRequest):
    urls = [str(u) for u in request.urls] if request.urls else settings.target_urls
    return await run_pipeline(
        urls,
        collector_id=request.collector_id,
        force_engine=request.force_engine,
    )


@app.post("/api/self-heal-loop", response_model=SelfHealingLoopResponse)
async def self_heal_loop(request: SelfHealingLoopRequest):
    return await run_closed_loop_self_healing(
        collector_id=request.collector_id,
        target_url=request.target_url,
        issue_description=request.issue_description,
        auto_approve=request.auto_approve,
        re_run_after_approval=request.re_run_after_approval,
    )


@app.get("/api/updates")
def updates(ecosystem: str | None = None, limit: int = 100):
    return db.latest(ecosystem=ecosystem, limit=limit)


@app.get("/api/search")
def search(q: str = "", ecosystem: str | None = None, limit: int = 50):
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
    advisories = [DocUpdateItem.model_validate(x) for x in db.latest(limit=200)]
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


@app.post("/api/watcher/start", response_model=WatcherStatusResponse)
async def watcher_start(config: WatcherConfigRequest):
    await watcher_instance.start(config)
    return watcher_instance.status()


@app.post("/api/watcher/stop", response_model=WatcherStatusResponse)
def watcher_stop():
    watcher_instance.stop()
    return watcher_instance.status()


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
