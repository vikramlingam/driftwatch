import asyncio

from fastapi.testclient import TestClient

from backend.audit import _extract_mcp_config_names, audit_project_file, create_code_fix
from backend.db import Database
from backend.impact import scan_directory_for_impact, scan_file_for_impacts
from backend.main import app
from backend.models import DocUpdateItem, WatcherConfigRequest
from backend.scraper import run_closed_loop_self_healing
from backend.watcher import ContinuousDriftWatcher


def sample_item(entry="one", category="BREAKING_CHANGE", ecosystem="Stripe"):
    return DocUpdateItem(
        entry_id=entry,
        ecosystem=ecosystem,
        title="Charges API method deprecated",
        category=category,
        urgency="HIGH",
        plain_summary="The old charges endpoint is replaced by payment_intents.",
        affected_code=["charges", "payment_intents"],
        source_url="https://docs.stripe.com/changelog",
        execution_engine="bright_data_dca",
        scraped_at="2026-08-19T10:00:00Z"
    )


def test_fastapi_backend_startup_and_health_endpoints(tmp_path):
    """End-to-end smoke test validating FastAPI app import, routing, and operational health."""
    client = TestClient(app)
    
    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ready"

    # 2. Counts check
    res_c = client.get("/api/counts")
    assert res_c.status_code == 200
    assert "total" in res_c.json()

    # 3. Watcher status check
    res_w = client.get("/api/watcher/status")
    assert res_w.status_code == 200
    assert "is_running" in res_w.json()

    # 4. Local impact directory scan endpoint
    res_i = client.post("/api/impact/scan-directory", json={"directory_path": str(tmp_path)})
    assert res_i.status_code == 200
    assert "scanned_files_count" in res_i.json()


def test_upsert_and_fts(tmp_path):
    db = Database(tmp_path / "test.db")
    assert db.upsert_updates([sample_item()]) == 1
    # Test FTS prefix search
    results = db.search("charge")
    assert len(results) >= 1
    assert results[0]["entry_id"] == "one"

    # Test FTS search with special punctuation
    results_punct = db.search("charges:payment_intents-v1*")
    assert len(results_punct) >= 1

    # Atomic upsert of identical entry updates record
    assert db.upsert_updates([sample_item()]) == 1
    assert db.count() == 1


def test_audit_requirements(tmp_path):
    db = Database(tmp_path / "test.db")
    db.upsert_updates([sample_item()])
    content = """
    # Comments should be ignored
    -i https://pypi.org/simple
    stripe>=7.0.0; python_version >= '3.8'
    uvicorn[standard]>=0.30
    requests==2.31.0
    """
    result = audit_project_file(content, "requirements.txt", db)
    assert result.total_items_checked >= 3
    assert result.issues_found_count >= 1
    assert result.matches[0].package_or_tool == "stripe"
    assert result.matches[0].ready_to_use_fix is not None


def test_audit_package_json(tmp_path):
    db = Database(tmp_path / "test.db")
    db.upsert_updates([sample_item(entry="pkg-1", ecosystem="Stripe")])
    content = '{"dependencies": {"stripe": "^14.0.0", "next": "14.2.0"}}'
    result = audit_project_file(content, "package.json", db)
    assert result.total_items_checked == 2
    assert result.issues_found_count == 1
    assert result.matches[0].package_or_tool == "stripe"


def test_audit_mcp_config(tmp_path):
    db = Database(tmp_path / "test.db")
    db.upsert_updates([
        DocUpdateItem(
            entry_id="mcp-fs",
            ecosystem="MCP & Agent Tools",
            title="Filesystem tool roots schema updated",
            category="TOOL_SCHEMA_CHANGE",
            urgency="HIGH",
            plain_summary="Filesystem roots require explicit path verification.",
            affected_code=["filesystem", "server-filesystem"],
            source_url="https://modelcontextprotocol.io/",
            execution_engine="bright_data_dca",
            scraped_at="2026-08-19T10:00:00Z"
        )
    ])
    content = '''{
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        }
      }
    }'''
    names = _extract_mcp_config_names(content)
    assert "filesystem" in names
    result = audit_project_file(content, "mcp_config.json", db)
    assert result.issues_found_count >= 1


def test_local_code_impact_mapper(tmp_path):
    """Innovation 1: Test Local Code Impact Mapper."""
    db = Database(tmp_path / "test.db")
    db.upsert_updates([sample_item()])

    code_file = tmp_path / "payment_service.py"
    code_file.write_text("import stripe\n\ndef process():\n    return stripe.Charge.create(amount=500)\n")

    report = scan_directory_for_impact(str(tmp_path), db)
    assert report.scanned_files_count >= 1
    assert report.impacted_files_count >= 1
    assert len(report.matches) >= 1
    assert "stripe" in [m.symbol_matched for m in report.matches]


def test_proof_of_recovery_evidence_report(monkeypatch, tmp_path):
    """Innovation 2: Test Proof-of-Recovery Evidence Report generation."""
    from backend import scraper
    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))

    async def mock_diagnose(collector_id, target_url):
        return True, 0, "Selector miss on target container."

    async def mock_heal_cli(collector_id, prompt):
        return {"heal_success": True, "proposed_fix": "AI generated adaptive DOM selectors."}

    async def mock_approve_cli(collector_id):
        return {"approved": True, "approve_details": "Scraper approved successfully."}

    async def mock_trigger(urls, collector_id=None):
        return "job_healed_test_456"

    async def mock_poll(job_id, max_wait=15, interval=3):
        return [{
            "title": "Stripe API Recovered",
            "ecosystem": "Stripe",
            "category": "BREAKING_CHANGE",
            "urgency": "HIGH",
            "plain_summary": "Recovered data via Bright Data DCA.",
            "source_url": "https://docs.stripe.com/changelog",
            "affected_code": ["stripe", "payment_intents"],
        }]

    monkeypatch.setattr(scraper, "diagnose_collector_break", mock_diagnose)
    monkeypatch.setattr(scraper, "execute_heal_cli", mock_heal_cli)
    monkeypatch.setattr(scraper, "execute_approve_cli", mock_approve_cli)
    monkeypatch.setattr(scraper, "trigger_scrape", mock_trigger)
    monkeypatch.setattr(scraper, "poll_results", mock_poll)
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "test_token_123")

    res = asyncio.run(
        run_closed_loop_self_healing(
            collector_id="c_test_collector",
            target_url="https://docs.stripe.com/changelog",
            auto_approve=True,
            re_run_after_approval=True,
        )
    )
    assert res.final_status == "RECOVERED_AND_VERIFIED"
    assert res.evidence_report is not None
    assert res.evidence_report.execution_engine_used == "bright_data_dca"
    assert res.evidence_report.bright_data_verified_job_id == "job_healed_test_456"
    assert res.evidence_report.pre_heal_record_count == 0
    assert res.evidence_report.post_heal_record_count == 1
    assert len(res.evidence_report.evidence_sha256) == 64
    assert "title" in res.evidence_report.recovered_schema_fields


def test_continuous_drift_watcher_lifecycle(monkeypatch):
    """Innovation 3: Test Continuous Drift Watcher start, status, risk assessment, and stop."""
    from backend.watcher import assess_anomaly_risk
    
    # Test risk assessment logic
    class MockResClean:
        valid_items_saved = 5
        quarantined_items_count = 0

    class MockResEmpty:
        valid_items_saved = 0
        quarantined_items_count = 0

    class MockResViolation:
        valid_items_saved = 2
        quarantined_items_count = 1

    assert assess_anomaly_risk(MockResClean()) == "NONE"
    assert assess_anomaly_risk(MockResEmpty()) == "LOW_RISK"
    assert assess_anomaly_risk(MockResViolation()) == "HIGH_RISK"

    watcher = ContinuousDriftWatcher()
    assert watcher.is_running is False

    # Mock _monitor_loop to avoid live network delay during test
    async def mock_loop():
        await asyncio.sleep(0.01)

    monkeypatch.setattr(watcher, "_monitor_loop", mock_loop)

    async def run_test():
        await watcher.start(WatcherConfigRequest(interval_seconds=10, auto_approve_low_risk=True))
        assert watcher.is_running is True
        st = watcher.status()
        assert st.is_running is True
        assert st.interval_seconds == 10
        watcher.stop()
        assert watcher.is_running is False

    asyncio.run(run_test())


def test_zero_dummy_records_saved_on_failed_scrape(monkeypatch, tmp_path):
    from backend import scraper
    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))

    async def mock_scrape_fail(*args, **kwargs):
        raise RuntimeError("Network unreachable")

    monkeypatch.setattr(scraper, "scrape_target_url", mock_scrape_fail)
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "")

    result = asyncio.run(scraper.run_pipeline(["https://example.com/changelog"], force_engine="direct"))
    assert result.valid_items_saved == 0
    db = Database(tmp_path / "test.db")
    assert db.count() == 0
    assert len(result.pipeline_errors) >= 1


def test_malformed_records_are_quarantined_without_corrupting_db(monkeypatch, tmp_path):
    from backend import scraper
    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))

    async def mock_scrape_with_one_invalid(*args, **kwargs):
        return [
            {
                "title": "Valid Real Update",
                "ecosystem": "Stripe",
                "category": "FEATURE_UPDATE",
                "urgency": "LOW",
                "plain_summary": "Authentic Stripe documentation update with genuine details.",
                "source_url": "https://docs.stripe.com/changelog",
            },
            {
                "title": "x",
                "source_url": "invalid-url",
            }
        ]

    monkeypatch.setattr(scraper, "scrape_target_url", mock_scrape_with_one_invalid)
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "")

    result = asyncio.run(scraper.run_pipeline(["https://docs.stripe.com/changelog"], force_engine="direct"))
    assert result.valid_items_saved == 1
    assert result.quarantined_items_count == 1
    db = Database(tmp_path / "test.db")
    assert db.count() == 1


def test_self_healing_honors_auto_approve_disabled(monkeypatch, tmp_path):
    from backend import scraper
    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))

    async def mock_diagnose(collector_id, target_url):
        return True, 0, "DOM layout shifted."

    async def mock_heal_cli(collector_id, prompt):
        return {"heal_success": True, "proposed_fix": "Adaptive selectors ready for review."}

    monkeypatch.setattr(scraper, "diagnose_collector_break", mock_diagnose)
    monkeypatch.setattr(scraper, "execute_heal_cli", mock_heal_cli)

    res = asyncio.run(
        run_closed_loop_self_healing(
            collector_id="c_test_collector",
            target_url="https://docs.stripe.com/changelog",
            auto_approve=False,
        )
    )
    assert res.final_status == "APPROVAL_REQUIRED"
    assert res.step_3_approved is False
    assert res.step_4_rerun_success is False


def test_self_healing_honors_rerun_disabled(monkeypatch, tmp_path):
    from backend import scraper
    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))

    async def mock_diagnose(collector_id, target_url):
        return True, 0, "DOM layout shifted."

    async def mock_heal_cli(collector_id, prompt):
        return {"heal_success": True, "proposed_fix": "Adaptive selectors generated."}

    async def mock_approve_cli(collector_id):
        return {"approved": True, "approve_details": "Approved in Bright Data."}

    monkeypatch.setattr(scraper, "diagnose_collector_break", mock_diagnose)
    monkeypatch.setattr(scraper, "execute_heal_cli", mock_heal_cli)
    monkeypatch.setattr(scraper, "execute_approve_cli", mock_approve_cli)

    res = asyncio.run(
        run_closed_loop_self_healing(
            collector_id="c_test_collector",
            target_url="https://docs.stripe.com/changelog",
            auto_approve=True,
            re_run_after_approval=False,
        )
    )
    assert res.final_status == "HEAL_APPROVED_PENDING_RERUN"
    assert res.step_3_approved is True
    assert res.step_4_rerun_success is False


def test_create_code_fix_diff():
    diff = create_code_fix(
        "Stripe",
        old_code="stripe.Charge.create(amount=1000, currency='usd')",
        new_code="stripe.PaymentIntent.create(amount=1000, currency='usd')",
        sample_filename="checkout.py",
    )
    assert "--- a/checkout.py" in diff
    assert "+++ b/checkout.py" in diff
    assert "-stripe.Charge.create" in diff
    assert "+stripe.PaymentIntent.create" in diff


def test_database_clear_and_api_endpoint(monkeypatch, tmp_path):
    """Test clearing the database and FTS index on isolated test db."""
    test_db = Database(tmp_path / "test_isolated.db")
    test_db.upsert_updates([sample_item(entry="item-1"), sample_item(entry="item-2")])
    assert test_db.count() == 2
    assert len(test_db.search("charges")) == 2

    # Clear isolated database directly
    test_db.clear()
    assert test_db.count() == 0
    assert len(test_db.search("charges")) == 0

    # Test /api/clear-db via FastAPI TestClient isolated from live db
    from backend import main
    monkeypatch.setattr(main, "db", test_db)
    client = TestClient(app)
    res = client.post("/api/clear-db")
    assert res.status_code == 200
    assert res.json()["status"] == "cleared"


def test_parse_github_repo_helper():
    from backend.github_client import parse_github_repo

    # Test full https url
    owner, repo = parse_github_repo("https://github.com/fastapi/fastapi")
    assert owner == "fastapi"
    assert repo == "fastapi"

    # Test .git suffix
    owner, repo = parse_github_repo("https://github.com/stripe/stripe-python.git")
    assert owner == "stripe"
    assert repo == "stripe-python"

    # Test shorthand
    owner, repo = parse_github_repo("openai/openai-python")
    assert owner == "openai"
    assert repo == "openai-python"


def test_github_config_status_endpoint():
    client = TestClient(app)
    res = client.get("/api/github/config-status")
    assert res.status_code == 200
    data = res.json()
    assert "openrouter_configured" in data
    assert "openrouter_model" in data
    assert "github_token_configured" in data


def test_llm_code_review_and_fallback():
    from backend.llm_reviewer import review_code_with_llm
    from backend.models import LLMReviewRequest

    req = LLMReviewRequest(
        repo_name="myorg/payments-svc",
        file_path="src/payments.py",
        file_content="charge = stripe.Charge.create(amount=2000, currency='usd')",
        advisory_id="adv_stripe_01",
        advisory_title="Stripe Charge API Deprecation",
        advisory_summary="Legacy charge endpoint deprecated in favor of payment_intents.",
        symbol_matched="stripe.Charge",
    )

    resp = asyncio.run(review_code_with_llm(req))
    assert resp.risk_level in ["CRITICAL", "WARNING", "SAFE"]
    assert "PaymentIntent" in resp.patched_code or "driftwatch" in resp.patched_code.lower() or "stripe" in resp.patched_code
    assert resp.unified_diff != ""
    assert resp.suggested_pr_title != ""
    assert resp.suggested_pr_body != ""


def test_github_scan_endpoint_mock(monkeypatch):
    from backend.github_client import GitHubClient

    async def mock_scan(self, owner, repo, branch=None):
        return {
            "requirements.txt": "stripe>=7.0.0\nfastapi>=0.100.0",
            "app.py": "import stripe\nres = stripe.Charge.create(amount=100)",
        }, "main"

    monkeypatch.setattr(GitHubClient, "scan_repo_manifests_and_code", mock_scan)

    client = TestClient(app)
    res = client.post("/api/github/scan", json={"repo_url": "https://github.com/testowner/testrepo"})
    assert res.status_code == 200
    data = res.json()
    assert data["repo_name"] == "testowner/testrepo"
    assert data["default_branch"] == "main"
    assert "requirements.txt" in data["manifests_found"]
    assert data["scanned_files_count"] == 2


def test_markdown_changelog_parser():
    """Verify authentic extraction from markdown changelogs (CrewAI, LlamaIndex, Next.js)."""

    from backend.scraper import scrape_raw_markdown_changelog

    sample_md = """# Changelog
## [0.28.0] - 2026-06-15
### Breaking Changes
- `crewai.Agent.execute_task` parameter `tools` is now strictly required.
- Deprecated `crewai.Process.sequential_legacy` in favor of `crewai.Process.hierarchical`.

## [0.27.0] - 2026-05-10
### Features
- Added support for Ollama local runner tool definitions.
"""
    class MockResponse:
        status_code = 200
        text = sample_md

    class MockClient:
        async def get(self, url, **kwargs):
            return MockResponse()

    items = asyncio.run(scrape_raw_markdown_changelog("https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md", MockClient(), "CrewAI & Multi-Agent"))
    assert len(items) >= 2
    assert "0.28.0" in items[0]["title"] or "0.28.0" in items[0]["entry_id"]
    assert items[0]["category"] == "BREAKING_CHANGE"
    assert items[0]["urgency"] == "HIGH"
    assert "crewai.Agent.execute_task" in items[0]["plain_summary"]
    assert "crewai.Agent.execute_task" in items[0]["affected_code"] or "crewai" in items[0]["affected_code"]


def test_strict_normalization_quarantine_on_missing_fields():
    """Verify that records missing vital fields (e.g. empty summary or title) raise validation error and get quarantined."""
    import pytest

    from backend.scraper import _normalize

    # 1. Missing summary raises ValueError (quarantine candidate)
    with pytest.raises(ValueError, match="Missing or invalid 'plain_summary'"):
        _normalize({"title": "A plausible upstream update", "plain_summary": ""}, "https://docs.stripe.com", "direct")

    # 2. Missing title raises ValueError (quarantine candidate)
    with pytest.raises(ValueError, match="Missing or invalid 'title'"):
        _normalize({"title": "", "plain_summary": "Valid summary content here."}, "https://docs.stripe.com", "direct")


def test_add_custom_target_feed_endpoint(monkeypatch, tmp_path):
    """Verify adding custom target feed persists and informs continuous watcher without external network calls."""
    from datetime import datetime, timezone

    import backend.main as main_module
    from backend.config import settings
    from backend.models import ScrapePipelineResult
    from backend.watcher import watcher_instance

    test_db = Database(tmp_path / "test.db")
    original_targets = list(watcher_instance.target_urls)
    original_custom_targets = list(settings.custom_target_urls)
    monkeypatch.setattr(main_module, "db", test_db)

    async def mock_run_pipeline(*args, **kwargs):
        return ScrapePipelineResult(
            batch_id="batch-mock",
            urls_checked=["https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md"],
            total_items_found=1,
            valid_items_saved=1,
            quarantined_items_count=0,
            quarantined_errors=[],
            time_taken_seconds=0.01,
            finished_at=datetime.now(timezone.utc),
            execution_engine="direct",
        )
    monkeypatch.setattr("backend.main.run_pipeline", mock_run_pipeline)
    try:
        client = TestClient(app)
        res = client.post("/api/targets/add", json={"url": "https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "added"
        assert data["target_url"] == "https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md"
        assert data["monitored_targets_count"] >= 2
        assert test_db.get_custom_targets() == ["https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md"]
    finally:
        watcher_instance.target_urls = original_targets
        settings.custom_target_urls = original_custom_targets


def test_watcher_pending_repairs_approval_and_rejection():
    """Verify high-risk repairs approval queue, approve endpoint, and reject endpoint."""
    from backend.models import PendingRepairItem
    from backend.watcher import watcher_instance

    original_repairs = list(watcher_instance.pending_repairs)
    try:
        # Create dummy pending repair
        test_repair = PendingRepairItem(
            repair_id="test-repair-123",
            target_url="https://docs.stripe.com/changelog",
            risk_level="HIGH_RISK",
            issue_description="DOM mutation caused schema violation",
            proposed_fix="Updated selector for Stripe changelog",
            status="PENDING",
            created_at="2026-08-20T12:00:00Z",
        )
        watcher_instance.pending_repairs = [test_repair]

        client = TestClient(app)

        # 1. List pending repairs
        res_list = client.get("/api/watcher/pending-repairs")
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1
        assert res_list.json()[0]["repair_id"] == "test-repair-123"

        # 2. Reject repair
        res_reject = client.post("/api/watcher/reject-repair/test-repair-123")
        assert res_reject.status_code == 200
        assert res_reject.json()["status"] == "REJECTED"
    finally:
        watcher_instance.pending_repairs = original_repairs


def test_github_config_alias_endpoint():
    """Verify /api/github/config and /api/github/config-status both return config data."""
    client = TestClient(app)
    res1 = client.get("/api/github/config")
    res2 = client.get("/api/github/config-status")
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json() == res2.json()


def test_forced_bright_data_mode_reports_missing_configuration(monkeypatch, tmp_path):
    from backend import scraper

    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "")
    monkeypatch.setattr(scraper.settings, "bright_data_collector_id", "c_missing_token")

    result = asyncio.run(
        scraper.run_pipeline(
            ["https://docs.stripe.com/changelog"],
            force_engine="bright_data_dca",
        )
    )

    assert result.execution_engine == "bright_data_dca"
    assert result.valid_items_saved == 0
    assert result.pipeline_errors
    assert "BRIGHT_DATA_API_TOKEN" in result.pipeline_errors[0]


def test_auto_mode_sends_every_feed_to_bright_data_without_direct_fallback(monkeypatch, tmp_path):
    from backend import scraper

    stripe_url = "https://docs.stripe.com/changelog"
    openai_url = "https://raw.githubusercontent.com/openai/openai-python/main/CHANGELOG.md"
    triggered_urls = []
    direct_calls = []

    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "test-token")
    monkeypatch.setattr(scraper.settings, "bright_data_collector_id", "c_test")

    async def mock_trigger(urls, collector_id=None):
        triggered_urls.extend(urls)
        return "job-1"

    async def mock_poll(*args, **kwargs):
        return [{
            "entry_id": "dca-stripe",
            "title": "Stripe DCA update",
            "ecosystem": "Stripe",
            "category": "FEATURE_UPDATE",
            "urgency": "LOW",
            "plain_summary": "A valid Bright Data record.",
            "source_url": stripe_url,
        }, {
            "entry_id": "dca-openai",
            "title": "OpenAI DCA update",
            "ecosystem": "OpenAI",
            "category": "FEATURE_UPDATE",
            "urgency": "LOW",
            "plain_summary": "A second valid Bright Data record.",
            "source_url": openai_url,
        }]

    async def mock_direct(url, client):
        direct_calls.append(url)
        raise AssertionError("configured Bright Data runs must not invoke direct parsers")

    monkeypatch.setattr(scraper, "trigger_scrape", mock_trigger)
    monkeypatch.setattr(scraper, "poll_results", mock_poll)
    monkeypatch.setattr(scraper, "scrape_target_url", mock_direct)

    result = asyncio.run(scraper.run_pipeline([stripe_url, openai_url]))

    assert triggered_urls == [stripe_url, openai_url]
    assert direct_calls == []
    assert result.execution_engine == "bright_data_dca"
    assert result.valid_items_saved == 2
    assert result.quarantined_items_count == 0


def test_configured_dca_empty_result_never_uses_direct_parser(monkeypatch, tmp_path):
    from backend import scraper

    target_url = "https://docs.stripe.com/changelog"
    direct_calls = []

    monkeypatch.setattr(scraper.settings, "database_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(scraper.settings, "bright_data_api_token", "test-token")
    monkeypatch.setattr(scraper.settings, "bright_data_collector_id", "c_test")

    async def mock_trigger(urls, collector_id=None):
        return "job-empty"

    async def mock_poll(*args, **kwargs):
        return []

    async def mock_direct(url, client):
        direct_calls.append(url)
        raise AssertionError("configured Bright Data runs must not invoke direct parsers")

    monkeypatch.setattr(scraper, "trigger_scrape", mock_trigger)
    monkeypatch.setattr(scraper, "poll_results", mock_poll)
    monkeypatch.setattr(scraper, "scrape_target_url", mock_direct)

    result = asyncio.run(scraper.run_pipeline([target_url]))

    assert direct_calls == []
    assert result.execution_engine == "bright_data_dca"
    assert result.valid_items_saved == 0
    assert result.pipeline_errors == ["Bright Data DCA job job-empty returned no records."]


def test_impact_scanner_ignores_target_urls(monkeypatch, tmp_path):

    advisory = DocUpdateItem(
        entry_id="openai-url-only",
        ecosystem="OpenAI",
        title="OpenAI update",
        category="FEATURE_UPDATE",
        urgency="LOW",
        plain_summary="A normal update.",
        affected_code=["openai.ChatCompletion"],
        source_url="https://docs.example.com/changelog",
        execution_engine="direct",
    )
    content = "TARGETS = {'OpenAI': 'https://raw.githubusercontent.com/openai/openai-python/main/CHANGELOG.md'}\n"

    assert scan_file_for_impacts("targets.ts", content, [advisory]) == []


def test_watcher_approval_persists_verified_evidence(monkeypatch, tmp_path):
    from backend import watcher as watcher_module
    from backend.models import (
        PendingRepairItem,
        RecoveryEvidenceReport,
        SelfHealingLoopResponse,
    )

    monkeypatch.setattr(watcher_module.settings, "database_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(watcher_module.settings, "bright_data_collector_id", "c_test")

    evidence = RecoveryEvidenceReport(
        report_id="evidence-test",
        collector_id="c_test",
        target_url="https://docs.stripe.com/changelog",
        pre_heal_record_count=0,
        pre_heal_diagnostic="selector miss",
        bright_data_verified_job_id="job-test",
        execution_engine_used="bright_data_dca",
        post_heal_record_count=3,
        recovered_schema_fields=["title"],
        quarantined_contract_errors_count=0,
        timestamped_execution_trace=["verified"],
        approval_mode="AUTO_APPROVED",
        evidence_sha256="a" * 64,
    )

    async def mock_heal(**kwargs):
        return SelfHealingLoopResponse(
            collector_id="c_test",
            target_url="https://docs.stripe.com/changelog",
            step_1_break_detected=True,
            break_diagnostic="selector miss",
            step_2_heal_proposed="new selectors",
            step_3_approved=True,
            step_4_rerun_success=True,
            step_4_rerun_records_count=3,
            total_duration_seconds=0.1,
            stage_logs=["verified"],
            final_status="RECOVERED_AND_VERIFIED",
            evidence_report=evidence,
        )

    monkeypatch.setattr(watcher_module, "run_closed_loop_self_healing", mock_heal)
    watcher = ContinuousDriftWatcher()
    watcher.pending_repairs = [PendingRepairItem(
        repair_id="repair-test",
        target_url="https://docs.stripe.com/changelog",
        risk_level="HIGH_RISK",
        issue_description="schema shift",
        proposed_fix="new selectors",
        status="PENDING",
        created_at="2026-08-21T00:00:00Z",
    )]

    approved = asyncio.run(watcher.approve_repair("repair-test"))

    assert approved is not None
    assert approved.status == "APPROVED"
    assert approved.evidence_report is not None
    assert approved.evidence_report.post_heal_record_count == 3
