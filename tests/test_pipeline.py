import asyncio
from fastapi.testclient import TestClient
from backend.audit import audit_project_file, create_code_fix, _extract_mcp_config_names
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
    assert len(result.quarantined_errors) >= 1


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


def test_database_clear_and_api_endpoint(tmp_path):
    """Test clearing the database and FTS index."""
    db = Database(tmp_path / "test.db")
    db.upsert_updates([sample_item(entry="item-1"), sample_item(entry="item-2")])
    assert db.count() == 2
    assert len(db.search("charges")) == 2

    # Clear database
    db.clear()
    assert db.count() == 0
    assert len(db.search("charges")) == 0

    # Test /api/clear-db via FastAPI TestClient
    client = TestClient(app)
    res = client.post("/api/clear-db")
    assert res.status_code == 200
    assert res.json()["status"] == "cleared"
