"""Continuous background drift watcher and auto-heal monitor."""
import asyncio
from datetime import UTC, datetime
from typing import Any
from .config import settings
from .models import WatcherConfigRequest, WatcherStatusResponse
from .scraper import run_closed_loop_self_healing, run_pipeline


def assess_anomaly_risk(res) -> str:
    """Assess whether a scraper anomaly is LOW_RISK or HIGH_RISK."""
    if res.quarantined_items_count > 0:
        # Schema violation / corrupted payload is high risk
        return "HIGH_RISK"
    if res.valid_items_saved == 0:
        # Empty results / DOM selector miss is low risk adaptive shift
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
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def log(self, message: str):
        timestamp = datetime.now(UTC).strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.logs.append(entry)
        if len(self.logs) > 50:
            self.logs.pop(0)

    async def _monitor_loop(self):
        self.log("Continuous Drift Watcher active. Monitoring high-velocity schema feeds...")
        while self.is_running and not self._stop_event.is_set():
            self.last_run_at = datetime.now(UTC)
            for url in self.target_urls:
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
                    if risk != "NONE":
                        self.heal_events_triggered_count += 1
                        should_auto_approve = (self.auto_approve_low_risk and risk == "LOW_RISK")
                        self.log(f"Drift Anomaly detected on {url} (Risk: {risk}). Initiating heal (Auto-approve: {should_auto_approve})...")
                        
                        heal_res = await run_closed_loop_self_healing(
                            collector_id=collector_id,
                            target_url=url,
                            issue_description=f"Continuous Watcher ({risk}): Anomaly detected on live feed. Re-extract valid titles, summaries, and code tokens.",
                            auto_approve=should_auto_approve,
                            re_run_after_approval=True,
                        )
                        self.log(f"Auto-heal completed on {url}: Status = {heal_res.final_status} (Risk: {risk})")
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

    async def start(self, config: WatcherConfigRequest | None = None):
        if self.is_running:
            return
        if config:
            self.interval_seconds = max(10, config.interval_seconds)
            self.auto_approve_low_risk = config.auto_approve_low_risk
            self.target_urls = config.target_urls or self.target_urls
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
        )


watcher_instance = ContinuousDriftWatcher()
