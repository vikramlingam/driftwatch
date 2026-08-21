"""Command-line interface demonstrating Bright Data self-healing, code impact mapper, and continuous drift watcher."""
import argparse
import asyncio
import sys

import httpx

from .audit import audit_project_file
from .config import settings
from .db import Database
from .github_client import GitHubClient, parse_github_repo
from .impact import scan_directory_for_impact, scan_file_for_impacts
from .llm_reviewer import review_code_with_llm
from .models import DocUpdateItem, LLMReviewRequest
from .scraper import run_closed_loop_self_healing, run_pipeline
from .watcher import ContinuousDriftWatcher


def print_banner():
    print("=" * 75)
    print("  DriftWatch CLI — Bright Data Scraper Studio & Self-Healing Radar")
    print("=" * 75)


async def cmd_scan(args):
    print(f"\n[*] Scanning target URL: {args.url}")
    print(f"[*] Collector ID: {settings.bright_data_collector_id or 'default'}")
    res = await run_pipeline([args.url], collector_id=args.collector_id, force_engine=args.engine)
    print(f"[+] Engine Used: {res.execution_engine}")
    if res.bright_data_job_id:
        print(f"[+] Bright Data Job ID: {res.bright_data_job_id}")
    print(f"[+] Total Items Found: {res.total_items_found}")
    print(f"[+] Valid Items Saved to SQLite: {res.valid_items_saved}")
    print(f"[+] Quarantined Anomalies: {res.quarantined_items_count}")
    print(f"[+] Time Taken: {res.time_taken_seconds}s\n")
    if res.pipeline_errors:
        print("[!] Pipeline Errors:")
        for err in res.pipeline_errors:
            print(f"    - {err}")
    if res.quarantined_errors:
        print("[!] Quarantine Errors:")
        for err in res.quarantined_errors:
            print(f"    - {err}")


async def cmd_heal(args):
    print("\n[*] Initiating 4-Stage Closed-Loop Self-Healing Demonstration...")
    collector_id = args.collector_id or settings.bright_data_collector_id
    if not collector_id:
        print("[-] Error: No Collector ID provided via --collector-id or BRIGHT_DATA_COLLECTOR_ID in .env.")
        sys.exit(1)
    print(f"[*] Collector ID: {collector_id}")
    print(f"[*] Target URL: {args.url}")
    print(f"[*] Auto Approve: {not args.no_auto_approve}")
    print(f"[*] Re-run After Approval: {not args.no_rerun}")
    print("-" * 75)

    res = await run_closed_loop_self_healing(
        collector_id=collector_id,
        target_url=args.url,
        issue_description=args.prompt,
        auto_approve=(not args.no_auto_approve),
        re_run_after_approval=(not args.no_rerun),
    )

    for log in res.stage_logs:
        print(f"  {log}")

    print("-" * 75)
    print(f"[+] Final Status: {res.final_status}")
    print(f"[+] Re-run Verified Records: {res.step_4_rerun_records_count}")
    print(f"[+] Total Time: {res.total_duration_seconds}s")

    # Innovation 2: Proof-of-Recovery Evidence Report
    if res.evidence_report:
        print("\n" + "=" * 75)
        print(f"  [PROOF-OF-RECOVERY EVIDENCE REPORT: {res.evidence_report.report_id}]")
        print("=" * 75)
        print(f"  • Collector ID:            {res.evidence_report.collector_id}")
        print(f"  • Target URL:              {res.evidence_report.target_url}")
        print(f"  • Verified Engine:         {res.evidence_report.execution_engine_used}")
        print(f"  • Verified Job ID:         {res.evidence_report.bright_data_verified_job_id}")
        print(f"  • Recovered Records:       {res.evidence_report.post_heal_record_count} items")
        print(f"  • Contract Violations:     {res.evidence_report.quarantined_contract_errors_count} errors (quarantine isolated)")
        print(f"  • Recovered Schema Keys:   {', '.join(res.evidence_report.recovered_schema_fields)}")
        print(f"  • Approval Mode:           {res.evidence_report.approval_mode}")
        print(f"  • Verified Timestamp:      {res.evidence_report.generated_at.isoformat()}")
        print("=" * 75 + "\n")


def cmd_impact(args):
    """Innovation 1: Local Code Impact Mapper CLI."""
    db = Database(settings.db_path)
    print(f"\n[*] Scanning codebase directory: {args.path}")
    report = scan_directory_for_impact(args.path, db)
    print(f"[+] Scanned {report.scanned_files_count} files across project.")
    print(f"[+] Impacted Files: {report.impacted_files_count}")
    print(f"[+] Total Code Occurrences: {report.total_occurrences_found}\n")

    for idx, match in enumerate(report.matches[:15], 1):
        print(f"[{idx}] {match.file_path}:{match.line_number}")
        print(f"    Symbol:   {match.symbol_matched} -> Advisory: {match.advisory_title} ({match.urgency})")
        print(f"    Code:     {match.line_content}")
        if match.suggested_replacement:
            print(f"    Suggested: {match.suggested_replacement}")
        if match.unified_diff:
            print("    Diff Preview:")
            for d_line in match.unified_diff.splitlines():
                print(f"      {d_line}")
        print()


def cmd_audit(args):
    db = Database(settings.db_path)
    try:
        with open(args.file, "r") as f:
            content = f.read()
    except (OSError, UnicodeError) as e:
        print(f"[-] Could not read file {args.file}: {e}")
        sys.exit(1)

    file_type = "package.json" if "package.json" in args.file else ("mcp_config.json" if "mcp" in args.file else "requirements.txt")
    print(f"\n[*] Auditing manifest {args.file} against indexed upstream advisories...")
    res = audit_project_file(content, file_type, db)
    print(f"[+] Checked {res.total_items_checked} dependencies/tools.")
    print(f"[+] Upstream Risks Detected: {res.issues_found_count}\n")

    for idx, match in enumerate(res.matches, 1):
        print(f"--- [Risk #{idx}: {match.package_or_tool}] ---")
        print(f"  Warning: {match.plain_warning}")
        if match.ready_to_use_fix:
            print(f"  Fix Snippet:\n{match.ready_to_use_fix.strip()}")
        print()


async def cmd_watch(args):
    """Innovation 3: Continuous Drift Watcher CLI."""
    watcher = ContinuousDriftWatcher()
    watcher.interval_seconds = args.interval
    watcher.auto_approve_low_risk = not args.manual_approval
    print(f"\n[*] Starting Continuous Drift Watcher (Interval: {args.interval}s, Auto-Approve: {watcher.auto_approve_low_risk})...")
    print("[*] Press Ctrl+C to stop.")
    await watcher.start()
    try:
        while True:
            await asyncio.sleep(5)
            st = watcher.status()
            if st.recent_watcher_logs:
                print(f"  -> {st.recent_watcher_logs[0]}")
    except KeyboardInterrupt:
        watcher.stop()
        print("\n[*] Continuous Drift Watcher stopped.")


async def cmd_github_scan(args):
    """Scan remote GitHub repository manifests and code files against DriftWatch advisories."""
    print(f"\n[*] Inspecting GitHub repository: {args.repo} ...")
    try:
        owner, repo = parse_github_repo(args.repo)
    except ValueError as e:
        print(f"[-] Error: {e}")
        sys.exit(1)

    client = GitHubClient(token=args.token or settings.github_token)
    try:
        found_files, branch = await client.scan_repo_manifests_and_code(owner, repo, branch=args.branch)
    except (httpx.HTTPError, OSError, RuntimeError, ValueError) as e:
        print(f"[-] GitHub Scan Error: {e}")
        sys.exit(1)

    db = Database(settings.db_path)
    advisories = [DocUpdateItem.model_validate(x) for x in db.latest(limit=200)]
    all_matches = []

    print(f"[+] Repository: {owner}/{repo} (Default Branch: {branch})")
    print(f"[+] Files Scanned: {len(found_files)}")
    print("-" * 75)

    for file_path, content in found_files.items():
        matches = scan_file_for_impacts(file_path, content, advisories)
        if matches:
            all_matches.extend(matches)
            print(f"[!] Impact in {file_path} ({len(matches)} occurrences):")
            for m in matches:
                print(f"    Line {m.line_number} [{m.urgency}]: {m.symbol_matched} -> {m.advisory_title}")

    print("-" * 75)
    print(f"Total Drift Impacts Found: {len(all_matches)}")


async def cmd_github_pr(args):
    """Run OpenRouter LLM code review and automatically open a GitHub PR."""
    print(f"\n[*] Initiating AI Code Review & GitHub PR for {args.repo} / {args.file} ...")
    try:
        owner, repo = parse_github_repo(args.repo)
    except ValueError as e:
        print(f"[-] Error: {e}")
        sys.exit(1)

    token = args.token or settings.github_token
    if not token:
        print("[-] Error: GITHUB_TOKEN is required to open a PR. Set GITHUB_TOKEN in .env or pass --token.")
        sys.exit(1)

    client = GitHubClient(token=token)
    content, _ = await client.fetch_file_content(owner, repo, args.file, ref=args.branch)

    # Prepare LLM Review Request
    review_req = LLMReviewRequest(
        repo_name=f"{owner}/{repo}",
        file_path=args.file,
        file_content=content,
        advisory_id="cli_advisory",
        advisory_title=args.advisory_title or "Upstream API Migration",
        advisory_summary=args.advisory_summary or "API breaking changes require method migration.",
        symbol_matched=args.symbol or "API",
        model_override=args.model,
    )

    print(f"[*] Consulting OpenRouter LLM ({args.model or settings.openrouter_model})...")
    review_resp = await review_code_with_llm(review_req)

    print(f"[+] Review Mode: {review_resp.execution_mode}")
    print(f"[+] Risk Level: {review_resp.risk_level} (Score: {review_resp.risk_score}/100)")
    print(f"[+] Summary: {review_resp.review_summary}")
    print("\n--- Diff Preview ---")
    print(review_resp.unified_diff)
    print("--------------------")

    if args.dry_run:
        print("[*] Dry run enabled. Skipping branch creation and PR opening.")
        return

    print(f"[*] Creating branch and opening Pull Request on {owner}/{repo}...")
    pr_res = await client.create_pull_request(
        owner=owner,
        repo=repo,
        file_path=args.file,
        patched_code=review_resp.patched_code,
        pr_title=review_resp.suggested_pr_title,
        pr_body=review_resp.suggested_pr_body,
        base_branch=args.branch or "main",
    )
    print("\n[+] SUCCESS! Pull Request Opened:")
    print(f"    URL: {pr_res['pr_url']}")
    print(f"    Branch: {pr_res['branch_created']}")


def main():
    parser = argparse.ArgumentParser(description="DriftWatch Terminal CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # scan command
    p_scan = subparsers.add_parser("scan", help="Scan documentation feed")
    p_scan.add_argument("--url", default="https://docs.stripe.com/changelog", help="Documentation URL")
    p_scan.add_argument("--collector-id", default=None, help="Bright Data Collector ID")
    p_scan.add_argument("--engine", default="auto", choices=["auto", "bright_data_dca", "direct"], help="Execution engine")

    # heal command
    p_heal = subparsers.add_parser("heal", help="Run 4-stage closed-loop self-healing demo")
    p_heal.add_argument("--collector-id", default=None, help="Bright Data Collector ID")
    p_heal.add_argument("--url", default="https://docs.stripe.com/changelog", help="Documentation URL")
    p_heal.add_argument("--prompt", default="DOM layout shifted. Extract updated headings and breaking changes.", help="Heal description")
    p_heal.add_argument("--no-auto-approve", action="store_true", help="Do not automatically approve proposed heal")
    p_heal.add_argument("--no-rerun", action="store_true", help="Do not automatically re-run collector after approval")

    # impact command (Innovation 1)
    p_impact = subparsers.add_parser("impact", help="Scan project directory for impacted symbols & generate patches")
    p_impact.add_argument("--path", default=".", help="Local directory path to scan")

    # watch command (Innovation 3)
    p_watch = subparsers.add_parser("watch", help="Continuous background drift watcher")
    p_watch.add_argument("--interval", type=int, default=60, help="Check interval in seconds")
    p_watch.add_argument("--manual-approval", action="store_true", help="Require manual human approval for repairs")

    # audit command
    p_audit = subparsers.add_parser("audit", help="Audit local requirements.txt, package.json, or mcp_config.json")
    p_audit.add_argument("file", help="Path to manifest file")

    # github-scan command (Innovation: Remote GitHub Inspection)
    p_gh_scan = subparsers.add_parser("github-scan", help="Scan remote GitHub repository for upstream drift")
    p_gh_scan.add_argument("--repo", required=True, help="GitHub repository (e.g. owner/repo or URL)")
    p_gh_scan.add_argument("--branch", default=None, help="Branch name (default: default branch)")
    p_gh_scan.add_argument("--token", default=None, help="GitHub Personal Access Token")

    # pr command (Innovation: AI Code Review & Autonomous PR)
    p_pr = subparsers.add_parser("pr", help="Run AI code review & raise PR on GitHub")
    p_pr.add_argument("--repo", required=True, help="GitHub repository (e.g. owner/repo or URL)")
    p_pr.add_argument("--file", required=True, help="Target file path in repository")
    p_pr.add_argument("--symbol", default="stripe", help="Impacted symbol/API keyword")
    p_pr.add_argument("--advisory-title", default="API Migration", help="Advisory title")
    p_pr.add_argument("--advisory-summary", default="Upstream API changes require refactoring.", help="Advisory summary")
    p_pr.add_argument("--model", default=None, help="OpenRouter model name")
    p_pr.add_argument("--branch", default="main", help="Base branch")
    p_pr.add_argument("--token", default=None, help="GitHub Personal Access Token")
    p_pr.add_argument("--dry-run", action="store_true", help="Generate review and diff without opening PR")

    args = parser.parse_args()
    print_banner()

    if args.command == "scan":
        asyncio.run(cmd_scan(args))
    elif args.command == "heal":
        asyncio.run(cmd_heal(args))
    elif args.command == "impact":
        cmd_impact(args)
    elif args.command == "watch":
        asyncio.run(cmd_watch(args))
    elif args.command == "audit":
        cmd_audit(args)
    elif args.command == "github-scan":
        asyncio.run(cmd_github_scan(args))
    elif args.command == "pr":
        asyncio.run(cmd_github_pr(args))


if __name__ == "__main__":
    main()
