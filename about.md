# DriftWatch — Project Overview

DriftWatch is a local-first developer intelligence radar for API breaking changes, tool-schema drift, and silent deprecations. It monitors public documentation and changelog feeds, validates structured updates, indexes them in SQLite FTS5, maps advisories to source code, and provides a guarded self-healing workflow for Bright Data collectors.

The complete file-level diagram is in [`architecture.pdf`](./architecture.pdf).

## End-to-End Data Flow
 
1. The Next.js dashboard or CLI submits one or more public documentation URLs (29 ecosystem feeds monitored by default).
2. `backend/scraper.py` validates targets, submits the complete URL batch to the configured Bright Data DCA collector in an async non-blocking task, parses JSON/JSONL response payloads, and uses direct specialized Markdown/HTML parsers when `direct` is explicitly selected or DCA is not configured for local development.
3. Raw records are normalized into `DocUpdateItem` objects with canonical ecosystem tags from `backend/models.py`. Invalid records are quarantined; valid records are written to SQLite with FTS5 search support by `backend/db.py`.
4. The dashboard reads updates, health, watcher state, audit results, impact matches, and self-healing evidence from `backend/main.py`.
5. The impact mapper and manifest auditor compare indexed advisories with local or remote source code and produce candidate migration diffs. They do not modify application code automatically.
 
## Execution Engines
 
| Mode | Behavior |
| :--- | :--- |
| `direct` | Uses the built-in public-feed parsers only. |
| `bright_data_dca` | Requires both Bright Data credentials and a collector ID. It fails explicitly if the DCA run cannot be verified and never falls back silently. |
| `auto` | Sends every requested URL to Bright Data when both DCA credentials are configured, handling both JSON and JSONL datasets. Without DCA configuration, it uses local parsers as a development fallback. |

## Bright Data Self-Healing Loop

The self-healing path in `backend/scraper.py` is intentionally explicit:

```text
1. Diagnose collector output and measure pre-heal records
2. Run `npx -p @brightdata/cli bdata scraper heal ...`
3. Approve with `npx -p @brightdata/cli bdata scraper approve ...`
4. Re-run with `force_engine="bright_data_dca"`
5. Validate records and emit a SHA-256 evidence report
```

The loop can stop with `HEAL_FAILED`, `APPROVAL_REQUIRED`, `RE_RUN_FAILED`, or `HEAL_APPROVED_PENDING_RERUN`. A successful run returns `RECOVERED_AND_VERIFIED` only when the verified engine is Bright Data DCA and valid records were saved.

## Main Backend Modules

| File | Responsibility |
| :--- | :--- |
| `backend/main.py` | Local-only FastAPI routes, CORS, health, explicit scraping, audits, impact, watcher, self-healing, and GitHub routes. |
| `backend/scraper.py` | Bright Data trigger/polling, direct feed parsers, normalization, quarantine, pipeline telemetry, and self-healing stages. |
| `backend/watcher.py` | Async recurring monitoring, risk classification, pending repair queue, approval/rejection, and evidence persistence. |
| `backend/db.py` | SQLite schema, FTS5 index, advisory persistence, custom targets, watcher repairs, and evidence storage. |
| `backend/models.py` | Strict Pydantic contracts shared by scraper, API, watcher, and UI responses. |
| `backend/policy.py` | Public HTTP(S) target validation and SSRF/government-domain restrictions. |
| `backend/impact.py` | Source-file scanning, advisory matching, false-positive filtering, and unified diff previews. |
| `backend/audit.py` | `requirements.txt`, `package.json`, and `mcp_config.json` audit logic. |
| `backend/github_client.py` | GitHub repository/file access and branch/PR operations. |
| `backend/llm_reviewer.py` | OpenRouter review with a rule-based fallback and patch generation. |
| `backend/cli.py` | `scan`, `heal`, `impact`, `watch`, `audit`, `github-scan`, and `pr` commands. |
| `backend/config.py` | `.env`-backed settings and target URL resolution. |

## Frontend Modules

`frontend/app/page.tsx` owns application state and API calls. The UI is split into `Navbar`, `LeftSidebar`, `RightSidebar`, `LiveRadarTab`, `ImpactMapperTab`, `WatcherTab`, `ManifestAuditTab`, `GitHubPRTab`, and `Modals`. `frontend/types/index.ts` mirrors the API contracts. `Pagination.tsx`, `globals.css`, and the Next/Tailwind configuration provide shared presentation behavior.

## Safety Boundaries

- Only public HTTP(S) targets are accepted; URLs with credentials, local/private IPs, government domains, and military domains are rejected.
- The API is intended for local use and is restricted to loopback requests.
- Invalid scrape records are quarantined instead of being written to SQLite.
- Impact mapping, manifest auditing, and LLM review produce previews. GitHub PR creation is an explicit user action and requires credentials.
- The default UI can request the curated feed map in `frontend/types/index.ts`; `.env` can additionally configure backend defaults and custom feeds.

## Running and Verifying

```bash
./run.sh
pytest -q -W error
ruff check backend tests
python3 -m compileall -q backend main.py
cd frontend && npm run build
```

The repository includes the Bright Data collector definition, interaction script, parser, and example structured output under `bright_data/`. Live DCA, GitHub, OpenRouter, and submission-video verification require the relevant external credentials or portal actions.
