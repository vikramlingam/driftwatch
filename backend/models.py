"""Strict data contracts exchanged by the scraper, API, and UI."""
from datetime import UTC, datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DocUpdateItem(StrictModel):
    entry_id: str
    ecosystem: str
    title: str = Field(min_length=3, max_length=200)
    category: Literal["BREAKING_CHANGE", "DEPRECATION", "FEATURE_UPDATE", "TOOL_SCHEMA_CHANGE"]
    urgency: Literal["HIGH", "MEDIUM", "LOW"]
    plain_summary: str = Field(min_length=5)
    affected_code: list[str] = Field(default_factory=list)
    source_url: HttpUrl
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    execution_engine: str
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ScrapeRequest(StrictModel):
    urls: list[HttpUrl] = Field(default_factory=lambda: ["https://docs.stripe.com/changelog"])
    collector_id: str | None = None
    force_engine: Literal["auto", "bright_data_dca", "direct"] = "auto"


class ProjectAuditRequest(StrictModel):
    file_type: Literal["requirements.txt", "package.json", "mcp_config.json"]
    file_content: str


class ProjectAuditMatch(StrictModel):
    package_or_tool: str
    matched_update: DocUpdateItem
    plain_warning: str
    ready_to_use_fix: str | None = None


class ProjectAuditResponse(StrictModel):
    file_type: str
    total_items_checked: int
    issues_found_count: int
    matches: list[ProjectAuditMatch]


class ScrapePipelineResult(StrictModel):
    batch_id: str
    urls_checked: list[str]
    total_items_found: int
    valid_items_saved: int
    quarantined_items_count: int
    quarantined_errors: list[str]
    time_taken_seconds: float
    finished_at: datetime
    execution_engine: str = "bright_data_dca"  # "bright_data_dca" or "direct"
    bright_data_job_id: str | None = None
    collector_id_used: str | None = None
    telemetry_logs: list[str] = Field(default_factory=list)


class RecoveryEvidenceReport(StrictModel):
    report_id: str
    collector_id: str
    target_url: str
    pre_heal_record_count: int
    pre_heal_diagnostic: str
    bright_data_verified_job_id: str | None
    execution_engine_used: str
    post_heal_record_count: int
    recovered_schema_fields: list[str]
    quarantined_contract_errors_count: int
    timestamped_execution_trace: list[str]
    approval_mode: Literal["AUTO_APPROVED", "MANUAL_APPROVED", "PENDING_APPROVAL"]
    evidence_sha256: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SelfHealingLoopRequest(StrictModel):
    collector_id: str | None = None
    target_url: str = "https://docs.stripe.com/changelog"
    issue_description: str = "The documentation layout updated. Re-extract release headlines, breaking changes, and affected methods."
    auto_approve: bool = True
    re_run_after_approval: bool = True


class SelfHealingLoopResponse(StrictModel):
    collector_id: str
    target_url: str
    step_1_break_detected: bool
    break_diagnostic: str
    step_2_heal_proposed: str | None
    step_3_approved: bool
    step_4_rerun_success: bool
    step_4_rerun_records_count: int
    total_duration_seconds: float
    stage_logs: list[str]
    final_status: Literal[
        "RECOVERED_AND_VERIFIED",
        "HEAL_FAILED",
        "APPROVAL_REQUIRED",
        "RE_RUN_FAILED",
        "HEAL_APPROVED_PENDING_RERUN",
    ]
    evidence_report: RecoveryEvidenceReport | None = None


# Innovation 1: Local Code Impact Models
class FileImpactMatch(StrictModel):
    file_path: str
    line_number: int
    line_content: str
    symbol_matched: str
    advisory_id: str
    advisory_title: str
    advisory_summary: str = ""
    ecosystem: str = "Custom"
    source_url: str = ""
    category: str
    urgency: str
    suggested_replacement: str | None = None
    unified_diff: str | None = None


class CodebaseImpactReport(StrictModel):
    target_directory: str
    scanned_files_count: int
    impacted_files_count: int
    total_occurrences_found: int
    matches: list[FileImpactMatch]
    summary_advisories_hit: list[str]


# Innovation 3: Continuous Watcher Models
class WatcherConfigRequest(StrictModel):
    interval_seconds: int = 120
    auto_approve_low_risk: bool = True
    target_urls: list[str] = Field(
        default_factory=lambda: [
            "https://docs.stripe.com/changelog",
            "https://raw.githubusercontent.com/modelcontextprotocol/specification/main/README.md",
        ]
    )


class WatcherStatusResponse(StrictModel):
    is_running: bool
    interval_seconds: int
    last_run_at: datetime | None
    monitored_targets_count: int
    heal_events_triggered_count: int
    auto_approve_enabled: bool
    recent_watcher_logs: list[str] = Field(default_factory=list)
