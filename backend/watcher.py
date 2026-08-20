"""Continuous background drift watcher and auto-heal monitor."""
import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any
from .config import settings
from .models import PendingRepairItem, WatcherConfigRequest, WatcherStatusResponse
from .scraper import run_closed_loop_self_healing, run_pipeline


def assess_anomaly_risk(res) -> str:
    """Assess whether a scraper anomaly is LOW_RISK, HIGH_RISK, or a transient NETWORK_ERROR."""
    errors = getattr(res, "errors", None) or getattr(res, "quarantined_errors", None)
    if errors:
        error_str = " ".join(errors).lower()
        if any(net in error_str for net in ["timeout", "connecterror", "connection reset", "connection refused", "httperror", "status 4", "status 5", "502", "503", "504"]):
            return "NETWORK_ERROR"
        return "HIGH_RISK"
    if getattr(res, "quarantined_items_count", 0) > 0:
        # Schema violation / corrupted payload is high risk
        return "HIGH_RISK"
    if getattr(res, "total_items_found", getattr(res, "valid_items_saved", -1)) == 0:
        # Zero items found from the parser means DOM selector drift, triggering low-risk auto-healing
        return "LOW_RISK"
    return "NONE"


class ContinuousDriftWatcher:
    def __init__(self):
        self.is_running: bool = False
        self.interval_seconds: int = 120
        self.auto_approve_low_risk: bool = True
        self.target_urls: list[str] = [
            "https://docs.stripe.com/changelog",
            "https://raw.githubusercontent.com/modelcontextprotocol/specification/main/README.md",
        ]
        self.last_run_at: datetime | None = None
        self.heal_events_triggered_count: int = 0
        self.logs: list[str] = []
        self.pending_repairs: list[PendingRepairItem] = []
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._load_persisted_state()

    def _load_persisted_state(self):
        """Load persisted custom targets and pending repairs from SQLite database."""
        try:
            from .db import Database
            db = Database(settings.database_path)
            custom_urls = db.get_custom_targets()
            for u in custom_urls:
                if u not in self.target_urls:
                    self.target_urls.append(u)
            
            persisted_repairs = db.get_pending_repairs()
            for pr in persisted_repairs:
                if not any(r.repair_id == pr["repair_id"] for r in self.pending_repairs):
                    self.pending_repairs.append(
                        PendingRepairItem(
                            repair_id=pr["repair_id"],
                            target_url=pr["target_url"],
                            risk_level=pr["risk_level"],
                            issue_description=pr["issue_description"],
                            proposed_fix=pr["proposed_fix"],
                            status=pr["status"],
                            created_at=pr["created_at"],
                            evidence_report=pr.get("evidence", {}),
                        )
                    )
        except Exception as exc:
            self.log(f"Watcher note: initializing local database state ({exc})")

    def log(self, message: str):
        timestamp = datetime.now(UTC).strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.logs.append(entry)
        if len(self.logs) > 50:
            self.logs.pop(0)

    def add_target(self, url: str):
        clean = url.strip()
        if clean:
            if clean not in self.target_urls:
                self.target_urls.append(clean)
            try:
                from .db import Database
                db = Database(settings.database_path)
                db.add_custom_target(clean)
            except Exception:
                pass
            self.log(f"Added and persisted target feed to watcher monitoring: {clean}")

    async def _monitor_loop(self):
        self.log("Continuous Drift Watcher active. Monitoring high-velocity schema feeds...")
        while self.is_running and not self._stop_event.is_set():
            self.last_run_at = datetime.now(UTC)
            for url in list(self.target_urls):
                if not self.is_running or self._stop_event.is_set():
                    break
                try:
                    self.log(f"Inspecting target: {url}...")
                    collector_id = settings.bright_data_collector_id

                    # 1. Use Bright Data DCA engine if collector is configured, else direct
                    engine_to_use = "bright_data_dca" if (collector_id and settings.bright_data_api_token) else "auto"
                    res = await run_pipeline([url], collector_id=collector_id, force_engine=engine_to_use)

                    # 2. Check for anomaly and assess risk level
                    risk = assess_anomaly_risk(res)
                    if risk == "NETWORK_ERROR":
                        self.log(f"Transient network/connection timeout on {url}. Skipping auto-heal to avoid false repair triggers.")
                        continue
                    elif risk != "NONE":
                        self.heal_events_triggered_count += 1
                        should_auto_approve = (self.auto_approve_low_risk and risk == "LOW_RISK")
                        repair_id = f"repair-{uuid.uuid4().hex[:8]}"

                        if should_auto_approve:
                            self.log(f"Drift Anomaly detected on {url} (Risk: {risk}). Auto-approving heal patch...")
                            heal_res = await run_closed_loop_self_healing(
                                collector_id=collector_id,
                                target_url=url,
                                issue_description=f"Continuous Watcher ({risk}): Anomaly detected on live feed. Re-extract valid titles, summaries, and code tokens.",
                                auto_approve=True,
                                re_run_after_approval=True,
                            )
                            self.log(f"Auto-heal completed on {url}: Status = {heal_res.final_status} (Risk: {risk})")
                        else:
                            self.log(f"High-Risk anomaly on {url} (Risk: {risk}). Queuing repair {repair_id} for manual approval...")
                            heal_res = await run_closed_loop_self_healing(
                                collector_id=collector_id,
                                target_url=url,
                                issue_description=f"Continuous Watcher ({risk}): High-risk anomaly detected on live feed.",
                                auto_approve=False,
                                re_run_after_approval=False,
                            )
                            pending_item = PendingRepairItem(
                                repair_id=repair_id,
                                target_url=url,
                                risk_level=risk,
                                issue_description=f"High-risk anomaly requiring human review: {heal_res.break_diagnostic}",
                                proposed_fix=heal_res.step_2_heal_proposed,
                                status="PENDING",
                                created_at=datetime.now(UTC).isoformat(),
                                evidence_report=heal_res.evidence_report,
                            )
                            self.pending_repairs.append(pending_item)
                            try:
                                from .db import Database
                                db = Database(settings.database_path)
                                db.save_pending_repair(pending_item.model_dump())
                            except Exception:
                                pass
                    else:
                        self.log(f"Feed verified healthy: {res.valid_items_saved} valid records from {url}")
                except asyncio.CancelledError:
                    return
                except Exception as exc:
                    self.log(f"Watcher error inspecting {url}: {str(exc)}")

            # Sleep between check intervals (interruptible via _stop_event)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                pass
            except asyncio.CancelledError:
                break

    async def approve_repair(self, repair_id: str) -> PendingRepairItem | None:
        for r in self.pending_repairs:
            if r.repair_id == repair_id and r.status == "PENDING":
                self.log(f"Repair {repair_id} manually approved by operator. Executing recovery re-run...")
                heal_res = await run_closed_loop_self_healing(
                    collector_id=settings.bright_data_collector_id,
                    target_url=r.target_url,
                    issue_description=r.issue_description,
                    auto_approve=True,
                    re_run_after_approval=True,
                )
                if heal_res.step_4_rerun_success and heal_res.final_status == "RECOVERED_AND_VERIFIED":
                    r.status = "APPROVED"
                    self.log(f"Repair {repair_id} verified & successfully deployed ({heal_res.evidence_report.get('records_recovered', 0)} records re-ingested).")
                else:
                    r.status = "RE_RUN_FAILED"
                    self.log(f"Repair {repair_id} recovery failed: {heal_res.final_status}. Review logs.")
                
                try:
                    from .db import Database
                    db = Database(settings.database_path)
                    db.update_pending_repair_status(repair_id, r.status)
                except Exception:
                    pass
                return r
        return None

    def reject_repair(self, repair_id: str) -> PendingRepairItem | None:
        for r in self.pending_repairs:
            if r.repair_id == repair_id and r.status == "PENDING":
                r.status = "REJECTED"
                self.log(f"Repair {repair_id} rejected by operator.")
                try:
                    from .db import Database
                    db = Database(settings.database_path)
                    db.update_pending_repair_status(repair_id, "REJECTED")
                except Exception:
                    pass
                return r
        return None

    async def start(self, config: WatcherConfigRequest | None = None):
        if self.is_running:
            return
        if config:
            self.interval_seconds = max(10, config.interval_seconds)
            self.auto_approve_low_risk = config.auto_approve_low_risk
            if config.target_urls:
                self.target_urls = config.target_urls
        self.is_running = True
        self._stop_event.clear()
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._monitor_loop())
        except RuntimeError:
            self._task = None

    def stop(self):
        self.is_running = False
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
        self.log("Continuous Drift Watcher paused.")

    def status(self) -> WatcherStatusResponse:
        return WatcherStatusResponse(
            is_running=self.is_running,
            interval_seconds=self.interval_seconds,
            last_run_at=self.last_run_at,
            monitored_targets_count=len(self.target_urls),
            heal_events_triggered_count=self.heal_events_triggered_count,
            auto_approve_enabled=self.auto_approve_low_risk,
            recent_watcher_logs=list(reversed(self.logs[-20:])),
            pending_repairs=list(reversed(self.pending_repairs[-20:])),
        )


watcher_instance = ContinuousDriftWatcher()
