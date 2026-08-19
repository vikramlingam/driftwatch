# DriftWatch - Project Overview and Architecture

## What Problem Does DriftWatch Solve?

When companies update their APIs, SDKs, or tools, they publish changelogs on public documentation pages. 

Two common problems happen every day:
1. Development teams do not notice that a method was deprecated or changed until their production application throws an error.
2. Web scrapers built to monitor these documentation sites break when the vendor updates their website layout or CSS selectors.

DriftWatch connects these two sides into a working closed loop:
1. It uses Bright Data Scraper Studio (DCA) to scrape and monitor public changelogs across cloud APIs, AI frameworks, and developer tools.
2. It parses and indexes every update into a SQLite full-text search engine with strict data schema validation.
3. If a scraper breaks because a vendor updated their website layout, DriftWatch triggers Bright Data's AI repair CLI (`bdata scraper heal`), approves the update in place (`bdata scraper approve`), and verifies the repaired scraper.
4. It scans local project repositories to show developers exactly which files and line numbers in their code use the deprecated methods, and outputs a git diff patch to update the code.

---

## How the System Works (End to End)

### 1. Data Collection via Bright Data DCA API

The backend triggers Bright Data DCA collectors by calling the API endpoint:
`POST https://api.brightdata.com/dca/trigger?collector=<COLLECTOR_ID>&queue_next=1`

Once triggered, DriftWatch polls for structured records:
`GET https://api.brightdata.com/dca/dataset?id=<JOB_ID>`

Target sources include:
- Stripe API changelog
- OpenAI Python SDK releases
- Anthropic SDK updates
- Model Context Protocol (MCP) tool schema specifications
- AWS Boto3, GCP GenAI, Supabase, FastAPI, LangChain, Ollama, ChromaDB

### 2. Schema Validation and Quarantine Isolation

Every raw record is passed through a strict Pydantic v2 contract model (`DocUpdateItem` in `backend/models.py`). 

Required fields:
- `entry_id` (string)
- `ecosystem` (string)
- `title` (string, 3 to 200 characters)
- `category` (`BREAKING_CHANGE`, `DEPRECATION`, `FEATURE_UPDATE`, or `TOOL_SCHEMA_CHANGE`)
- `urgency` (`HIGH`, `MEDIUM`, or `LOW`)
- `plain_summary` (string)
- `affected_code` (list of strings representing functions, packages, or methods)
- `source_url` (valid HTTP/HTTPS URL)

If a vendor's page changed so drastically that malformed records return without required fields, the invalid records are quarantined without polluting the database, and an anomaly event is raised.

### 3. The 4-Stage Closed-Loop Self-Healing Lifecycle

When a collector returns zero records or encounters a layout change, DriftWatch runs a 4-step recovery workflow:

```
[Step 1] Live Break Diagnosis:
         Runs a live test against the target documentation URL to verify if the collector fails or returns zero records.

[Step 2] AI Scraper Heal:
         Calls the Bright Data CLI repair tool:
         npx @brightdata/cli bdata scraper heal <COLLECTOR_ID> "Documentation layout updated. Extract headings and breaking changes."

[Step 3] Scraper Approval:
         Calls the Bright Data CLI approval tool:
         npx @brightdata/cli bdata scraper approve <COLLECTOR_ID>

[Step 4] Strict DCA Re-run Verification:
         Re-runs collection strictly enforcing force_engine="bright_data_dca". 
         It checks that the repaired collector successfully collected valid records.
         It generates a Proof-of-Recovery Report with measured pre/post counts, execution engine verification, and a SHA-256 payload digest.
```

### 4. Local Code Impact Mapper

Developers can point DriftWatch at any project folder on their machine.

For example, when pointed at a Python project containing:
```python
# checkout.py (Line 14)
charge = stripe.Charge.create(amount=2000, currency="usd")
```

The impact engine in `backend/impact.py`:
1. Scans the file AST and tokens against active advisories in SQLite.
2. Identifies that `stripe.Charge` was deprecated in the latest Stripe API release in favor of `stripe.PaymentIntent`.
3. Displays the file, line number, plain-English advisory summary, a direct button to Stripe's official docs, and generates a unified git diff:

```diff
--- a/checkout.py
+++ b/checkout.py
@@ -14,1 +14,1 @@
-charge = stripe.Charge.create(amount=2000, currency="usd")
+charge = stripe.PaymentIntent.create(amount=2000, currency="usd")
```

### 5. Continuous Drift Watcher

The backend includes an asynchronous background watcher (`backend/watcher.py`) that monitors configured documentation feeds on an interval:
- If a collection passes cleanly, it logs that the feed is healthy.
- If a collector breaks due to an adaptive layout shift with valid contracts (`LOW_RISK`), it triggers the self-healing workflow automatically.
- If a high-risk schema failure occurs (`HIGH_RISK`), it queues the repair for human approval.

---

## Codebase Map

| File | Role |
| :--- | :--- |
| `backend/main.py` | FastAPI application serving search, audits, self-healing endpoints, and watcher controls. |
| `backend/scraper.py` | Bright Data DCA triggers, authentic documentation parsers, CLI heal/approve runners, and recovery verification. |
| `backend/impact.py` | Code impact candidate mapper scanning project source files and generating migration diffs. |
| `backend/watcher.py` | Background monitoring loop and risk classification engine. |
| `backend/db.py` | SQLite database manager with synchronized FTS5 full-text search triggers. |
| `backend/models.py` | Pydantic v2 schemas for advisories, audits, recovery evidence reports, and watcher states. |
| `backend/cli.py` | Terminal interface for `scan`, `heal`, `impact`, `watch`, and `audit` commands. |
| `frontend/app/page.tsx` | Next.js dark-themed dashboard with Bento Box cards, impact mapper, watcher cockpit, and manifest auditor. |
| `tests/test_pipeline.py` | 14 automated pytest tests covering database, API endpoints, impact scanning, and self-healing. |

---

## How to Test and Run

### 1. One-Click Launch (Backend + Frontend)
```bash
./run.sh
```
This single command checks dependencies, starts FastAPI on `http://localhost:8000`, and launches Next.js on `http://localhost:3000`. Press `Ctrl+C` anytime to cleanly shut down both servers.

### 2. Run Automated Unit Tests
```bash
pytest -v
```
All 14 tests pass deterministically in under 0.5 seconds with zero external network dependencies.

### 4. Run Terminal CLI Commands
```bash
# Scan code impact on any local directory:
python3 -m backend.cli impact --path .

# Run the 4-stage self-healing demo:
python3 -m backend.cli heal --collector-id c_collector_id --url https://docs.stripe.com/changelog

# Start continuous background watcher:
python3 -m backend.cli watch --interval 60
```
