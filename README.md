# Drift Watch: API Drift & Breaking Change Intelligence Radar

> **By Team Siloed** &bull; Built for the Bright Data & WeMakeDevs Scrape-Verse Hackathon

Drift Watch is a developer intelligence radar for API breaking changes, tool schema drift, and silent deprecations across developer ecosystems. It collects updates via **Bright Data Scraper Studio (DCA)**, executes an authentic **4-stage closed-loop self-healing lifecycle** (`bdata scraper heal` + `bdata scraper approve`), strictly validates schema contracts with Pydantic v2 quarantine isolation, and maps upstream impact candidates directly into local codebases.

The complete file-level architecture is documented in [`architecture.pdf`](./architecture.pdf), including every backend, frontend, test, launcher, and Bright Data source file.

---

## Core Capabilities

### 1. Local Code Impact Mapper (Candidate Analyzer)
Points DriftWatch at a local repository directory to identify potential impact candidates (files, functions, packages, or MCP tools) that may break due to upstream changes. Generates a **concrete migration patch preview (unified git diff)**.
- **CLI**: `python3 -m backend.cli impact --path ./my_project`
- **UI**: Dedicated **Code Impact Mapper** tab in the dashboard.
- **API**: `POST /api/impact/scan-directory`

### 2. Proof-of-Recovery Evidence Report
A successful self-healing run generates a verifiable recovery digest report detailing:
- Measured pre-healing record count & anomaly diagnosis
- Verified Execution Engine (`bright_data_dca`)
- Bright Data Verified Job ID & Collector ID
- Post-healing record count & validated schema contract fields
- 0 quarantined contract violations
- Full JSON-payload SHA-256 digest fingerprint (`evidence_sha256`)
- Timestamped execution trace log

### 3. Continuous Drift Watcher (Autonomous Scraper with Risk Scoring)
Background monitoring daemon that periodically inspects configured documentation feeds using Bright Data DCA when it is configured, with direct public-feed parsers available for local development when DCA credentials are absent. When an anomaly is detected, DriftWatch assesses the risk:
- **Low-risk adaptive shifts** (empty selector/DOM shift with valid schema contract): Auto-approved and verified.
- **High-risk breaking shifts** (schema violations / missing fields): Queued for human approval.
- **CLI**: `python3 -m backend.cli watch --interval 60`
- **UI**: Live **Continuous Watcher Cockpit** with real-time status and activity feed.

### 4. GitHub AI Remediation & Autonomous PR Studio (OpenRouter + GitHub Bot)
Autonomous remote repository analysis, multi-model OpenRouter LLM code review, and automated GitHub Pull Request creation.
- **Remote Inspection**: Scans remote GitHub manifests (`requirements.txt`, `package.json`, `pyproject.toml`, `mcp_config.json`, `README.md`) against indexed drift advisories.
- **Multi-Model LLM Engine**: Powered by OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL` in `.env`) delivering in-depth breaking change risk reviews, refactored code synthesis, and unified diffs.
- **Autonomous GitHub PR Bot**: Automatically creates migration branch `driftwatch/patch-...`, commits the patch, and opens a Pull Request on GitHub with rich advisory metadata.
- **CLI**: `python3 -m backend.cli github-scan --repo owner/repo` and `python3 -m backend.cli pr --repo owner/repo --file path/to/file`
- **UI**: Dedicated **GitHub AI Studio & PR** tab in the dashboard.

### 5. Live Radar HUD & Non-Blocking Scraper Studio
- **Asynchronous Background Scanning**: Scans run in a non-blocking background task (`POST /api/scrape` returns instantly with a `job_key`), allowing the dashboard to update dynamically as records are validated and saved.
- **Visual Radar HUD**: Neon radar sweep scope, rotating target node blips across 29 documentation feeds, live telemetry terminal logs, and 4-stage pipeline status indicators.
- **Holographic Shimmer Skeletons**: Provides instant visual structure while Bright Data DCA polls and extracts upstream records.
- **Ecosystem Bucketing**: Canonical URL-to-ecosystem mapping organizing advisories into their respective documentation feeds in the sidebar.

---

## 4-Stage Closed-Loop Self-Healing Lifecycle

DriftWatch proves full recovery across all 4 stages without modifying any downstream application code:

```
[Step 1/4] Live Break Diagnostic  -> Checks selector resolution & measures pre-heal record count on target URL.
[Step 2/4] AI Scraper Heal        -> Executes `bdata scraper heal <COLLECTOR_ID> "<PROMPT>"`
[Step 3/4] In-Place Approval      -> Executes `bdata scraper approve <COLLECTOR_ID>` (if approved)
[Step 4/4] Re-Run Verification    -> Strictly re-runs with force_engine='bright_data_dca'
                                     to verify genuine record extraction and generate the Evidence Report.
```

---

## High-Velocity & Long-Tail Ecosystem Feeds

DriftWatch indexes 29 AI and web ecosystem documentation changelogs (available in [`bright_data/target_urls_29.csv`](./bright_data/target_urls_29.csv)):
- **LangChain & LangGraph Agents**: Rapid Runnable / tool schema definitions.
- **CrewAI Multi-Agent Framework**: Process orchestration and tool contract updates.
- **LlamaIndex & RAG Engine**: Vector store index and retrieval contract changes.
- **LiteLLM, DSPy, vLLM, Instructor**: Gateway routing, inference, and structured output specs.
- **Pinecone, ChromaDB, Qdrant, Weaviate**: High-velocity vector index schema changes.
- **Next.js 15 & React 19, Astro, Bun, Tailwind CSS v4**: Async params, Server Actions, and styling contracts.
- **Pydantic v2, Prisma, Drizzle ORM**: Strict model validation and database schema contracts.
- **Ollama Local LLM Runner**: Local model tool-calling specs.
- **Model Context Protocol (MCP)**: Tool schema contracts, SSE/stdio transports.
- **Stripe, OpenAI, Anthropic, AWS Boto3, GCP GenAI, Supabase, FastAPI**: Official changelogs.

---

## Quick Start & Installation

### Prerequisites
- **Python**: 3.11+ (Python 3.12 or 3.13 recommended)
- **Node.js**: 18.0+ (Node.js 20+ recommended) & `npm`

---

### Step-by-Step Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/vikramlingam/driftwatch.git
cd driftwatch
```

#### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` to configure your credentials (see [`SCRAPER_STUDIO_SETUP.md`](./SCRAPER_STUDIO_SETUP.md) for collector setup):
```ini
BRIGHT_DATA_API_TOKEN=your_bright_data_token_here
BRIGHT_DATA_COLLECTOR_ID=c_mt2slsnef0likmk7o
DATABASE_PATH=driftwatch.db
DEFAULT_TARGET_URLS=https://docs.stripe.com/changelog
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
OPENROUTER_API_KEY=your_openrouter_api_key_optional
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
GITHUB_TOKEN=your_github_token_optional
```

#### 3. Install Dependencies

##### Python Backend:
```bash
# Optional: create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install Python requirements
pip install -r requirements.txt
```

##### Next.js Frontend:
```bash
cd frontend
npm install
cd ..
```

---

### Running DriftWatch

#### Option A: One-Click Launcher (Recommended)
Make the launch script executable and run:
```bash
chmod +x run.sh
./run.sh
```
This script automatically checks environment variables, installs any missing dependencies, starts the FastAPI backend on `http://127.0.0.1:8000`, and launches the Next.js frontend on `http://localhost:3000`. Press `Ctrl+C` anytime to cleanly terminate both services.

#### Option B: Manual Launch (Two Terminals)

**Terminal 1 (Backend):**
```bash
python3 -m uvicorn backend.main:app --port 8000 --host 127.0.0.1
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev -- -p 3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Bright Data CLI Authentication

To enable AI self-healing repairs from your machine or terminal, log in to the Bright Data CLI:

```bash
# Authenticate with your Bright Data Account / API Token:
npx @brightdata/cli bdata login
```

For full details on the Scraper Studio collector setup, universal Cheerio parser, interaction code, and 29-feed batch dataset, see [`SCRAPER_STUDIO_SETUP.md`](./SCRAPER_STUDIO_SETUP.md).

---

## Terminal CLI Workflows

```bash
# 1. Scan codebase for impacted candidate files and generate migration diffs:
python3 -m backend.cli impact --path .

# 2. Run 4-stage closed-loop self-healing demo & generate Proof-of-Recovery Report:
python3 -m backend.cli heal --collector-id c_collector_id --url https://docs.stripe.com/changelog

# 3. Start the continuous background drift watcher daemon with risk scoring:
python3 -m backend.cli watch --interval 60

# 4. Scan a target feed with execution telemetry:
python3 -m backend.cli scan --url https://docs.stripe.com/changelog

# 5. Audit local manifest for upstream breaking changes:
python3 -m backend.cli audit requirements.txt

# 6. Scan a remote GitHub repository for upstream breaking changes:
python3 -m backend.cli github-scan --repo fastapi/fastapi

# 7. Run AI code review & raise an automated GitHub Pull Request:
python3 -m backend.cli pr --repo owner/repo --file app/payments.py --symbol stripe
```

---

## Automated Test and Quality Verification

Run the full automated test suite and code quality checks:

```bash
# 1. Run full test suite with zero warnings
pytest -q -W error

# 2. Code linting
ruff check backend tests

# 3. Bytecode validation
python3 -m compileall -q backend main.py

# 4. Production frontend build check
cd frontend && npm run build && cd ..
```

The automated suite verifies:
- **FastAPI backend startup, routing, and operational health endpoints**.
- SQLite FTS5 synchronized search and fast indexed query execution.
- Manifest auditing (`requirements.txt`, `package.json`, `mcp_config.json`).
- **Local Code Impact Mapper candidate scanner and unified diff preview**.
- **Universal Markdown/RST changelog parser (CrewAI, LlamaIndex, Next.js, etc.)**.
- **Proof-of-Recovery Evidence Report compilation with SHA-256 payload digest**.
- **Continuous Drift Watcher lifecycle, risk scoring, and manual approval queue**.
- **Custom target feed registration and watcher persistence**.
- **Strict schema contract quarantine with zero fabricated dummy records**.
- **OpenRouter multi-model review, git diff patch synthesizer, and fallback engine**.
- **Full 4-stage closed-loop self-healing lifecycle**.
- **Honored `auto_approve` and `re_run_after_approval` branches**.
- Bright Data configuration failures, complete multi-feed DCA coverage without direct fallback, target URL policy, impact false-positive filtering, and watcher evidence persistence regressions.

---

## Runtime Behavior and Safety Boundaries

- `force_engine=bright_data_dca` requires both `BRIGHT_DATA_API_TOKEN` and `BRIGHT_DATA_COLLECTOR_ID`; it never silently falls back to direct scraping.
- `force_engine=auto` submits the complete requested URL batch to Bright Data when both DCA credentials are configured. It supports standard JSON and JSONL datasets returned by Scraper Studio. If DCA is not configured, auto mode uses local parsers as a development fallback.
- Scrape targets must be public HTTP(S) URLs. The API rejects credentials in URLs, private or loopback network targets, and government or military domains.
- The API is restricted to local requests, and `run.sh` binds the backend to `127.0.0.1`.

---

## Hackathon Submission Deliverables & Compliance

The repository contains complete artifacts and evidence for all hackathon submission requirements:

### 1. Bright Data Custom Scraper Studio Collector
- **Collector ID**: `c_mt2slsnef0likmk7o` (`universal-docs-changelog`)
- **Collector Definition**: Exported in [`bright_data/collector_definition.json`](./bright_data/collector_definition.json)
- **Scraper Studio Interaction Script**: Exported in [`bright_data/collector_interaction.js`](./bright_data/collector_interaction.js)
- **Universal Cheerio DOM/Markdown Parser Script**: Exported in [`bright_data/collector_parser.js`](./bright_data/collector_parser.js)
- **Target Feeds Dataset (29 URLs)**: Exported in [`bright_data/target_urls_29.csv`](./bright_data/target_urls_29.csv)
- **Example Structured Output Dataset**: Exported in [`bright_data/example_structured_output.json`](./bright_data/example_structured_output.json)

### 2. Public Data Only
- Default feeds are public documentation or public open-source changelogs (Stripe, OpenAI, Anthropic, AWS, GCP, Supabase, FastAPI, LangChain, CrewAI, LlamaIndex, Pinecone, Next.js, Pydantic).
- The API strictly rejects government, private-network, credentialed, and non-HTTP(S) scraping targets.

### 3. Demo Video
- **Walkthrough Demo Video**: [Watch the DriftWatch Demo Video](https://youtu.be/8no3eei6sdM)

### 4. AI Coding Assistant Disclosure
- **AI Tools Used**: Google Antigravity / Gemini was utilized as an AI coding assistant during hackathon development for code formatting, frontend Bento styling, and rapid refactoring.
