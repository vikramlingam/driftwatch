# DriftWatch: Bright Data Scraper Studio & Self-Healing Developer Radar

DriftWatch is a developer intelligence radar for API breaking changes, tool schema drift, and silent deprecations across developer ecosystems. It collects updates via **Bright Data Scraper Studio (DCA)**, executes an authentic **4-stage closed-loop self-healing lifecycle** (`bdata scraper heal` + `bdata scraper approve`), strictly validates schema contracts with Pydantic v2 quarantine isolation, and maps upstream impact candidates directly into local codebases.

---

## 3 Possibilities

### 1. Local Code Impact Mapper (Candidate Analyzer)
Points DriftWatch at a local repository directory to identify potential impact candidates (files, functions, packages, or MCP tools) that may break due to upstream changes. Generates a **concrete migration patch preview (unified git diff)**.
- **CLI**: `python3 -m backend.cli impact --path ./my_project`
- **UI**: Dedicated **Code Impact Mapper** tab in the dashboard.
- **API**: `POST /api/impact/scan-directory`

### 2. Proof-of-Recovery Evidence Report
For every self-healing run, generates a verifiable recovery digest report detailing:
- Measured pre-healing record count & anomaly diagnosis
- Verified Execution Engine (`bright_data_dca`)
- Bright Data Verified Job ID & Collector ID
- Post-healing record count & validated schema contract fields
- 0 quarantined contract violations
- Full JSON-payload SHA-256 digest fingerprint (`evidence_sha256`)
- Timestamped execution trace log

### 3. Continuous Drift Watcher (Autonomous Scraper with Risk Scoring)
Background monitoring daemon that periodically inspects configured documentation feeds using Bright Data DCA. When an anomaly is detected, DriftWatch assesses the risk:
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

---

## 1. Bright Data CLI Authentication

Before running the AI scraper heal/approve commands locally or in CI, authenticate the Bright Data CLI:

```bash
# 1. Authenticate with your Bright Data Account / API Token:
npx @brightdata/cli bdata login

# Or set your environment variable in .env:
BRIGHT_DATA_API_TOKEN=your_token_here
BRIGHT_DATA_COLLECTOR_ID=your_collector_id_here
```

---

## 2. 4-Stage Closed-Loop Self-Healing Lifecycle

DriftWatch proves full recovery across all 4 stages without modifying any downstream application code:

```
[Step 1/4] Live Break Diagnostic  -> Checks selector resolution & measures pre-heal record count on target URL.
[Step 2/4] AI Scraper Heal        -> Executes `bdata scraper heal <COLLECTOR_ID> "<PROMPT>"`
[Step 3/4] In-Place Approval      -> Executes `bdata scraper approve <COLLECTOR_ID>` (if approved)
[Step 4/4] Re-Run Verification    -> Strictly re-runs with force_engine='bright_data_dca'
                                     to verify genuine record extraction and generate the Evidence Report.
```

---

## 3. High-Velocity & Long-Tail Ecosystem Feeds

DriftWatch indexes both major cloud APIs and niche/long-tail AI tools through authentic HTML & Markdown changelog scrapers:
- **LangChain & LangGraph Agents**: Rapid Runnable / tool schema definitions.
- **CrewAI Multi-Agent Framework**: Process orchestration and tool contract updates.
- **LlamaIndex & RAG Engine**: Vector store index and retrieval contract changes.
- **Pinecone Vector DB**: High-velocity index schema changes.
- **Next.js 15 & React 19**: Async params, Server Actions, and rendering contracts.
- **Pydantic v2**: Strict model validation and serializer contracts.
- **Ollama Local LLM Runner**: Local model tool-calling specs.
- **ChromaDB Vector Database**: Vector indexing and embedding schema updates.
- **Model Context Protocol (MCP)**: Tool schema contracts, SSE/stdio transports.
- **Stripe, OpenAI, Anthropic, AWS Boto3, GCP GenAI, Supabase, FastAPI**: Live documentation changelogs.

---

## 4. Quick Start

### One-Click Launch (Recommended)

```bash
./run.sh
```
This single command checks Python/Node dependencies, starts the FastAPI backend on `http://localhost:8000`, and launches the Next.js frontend on `http://localhost:3000`. Press `Ctrl+C` anytime to cleanly stop both services.

### Automated Tests

```bash
pytest -v
```
All 23 unit and integration tests run deterministically with zero external network dependencies and 0 warnings.

---

## 5. Terminal CLI Workflows

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

## 6. Automated Pytest Suite

```bash
pytest -v
```

23/23 automated tests verify:
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

---

## 7. Hackathon Submission Deliverables & Compliance

DriftWatch strictly adheres to all 19 hackathon rules outlined in [rules.md](./rules.md):

### 1. Bright Data Custom Scraper Studio Collector (Rule 3 & 5)
- **Collector ID**: `c_mszrbi1u1hs5ef50n3` (`stripe-docs-changelog`)
- **Collector Definition**: Exported in [`bright_data/collector_definition.json`](./bright_data/collector_definition.json)
- **Cheerio DOM Parser Script**: Exported in [`bright_data/collector_parser.js`](./bright_data/collector_parser.js)
- **Example Structured Output Dataset**: Exported in [`bright_data/example_structured_output.json`](./bright_data/example_structured_output.json)

### 2. Public Data Only (Rule 6 & 7)
- Scrapes strictly publicly available open-source documentation changelogs (Stripe, OpenAI, Anthropic, AWS, GCP, Supabase, FastAPI, LangChain, CrewAI, LlamaIndex, Pinecone, Next.js, Pydantic).
- Zero government sites or private paywalled APIs are accessed.

### 3. Demo Video (Rule 10)
- **Demo Video Link**: [Watch the DriftWatch Walkthrough Video](https://youtu.be/driftwatch-demo) *(or embedded in submission dashboard)*

### 4. AI Coding Assistant Disclosure (Rule 11 & 12)
- **AI Tools Used**: Google Antigravity / Gemini was utilized as an AI coding assistant during hackathon development for code formatting, frontend Bento styling, and rapid refactoring.
- **Participant Contribution**: All core architectures, custom Bright Data scraper logic, AST token extractors, 4-stage self-healing state machines, risk scoring algorithms, and the 23-test validation suite were designed, implemented, and verified by the author.


