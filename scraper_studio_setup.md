# Bright Data Scraper Studio Setup Guide

This guide walks you through setting up the **Universal Documentation & Changelog Collector** (`universal-docs-changelog`) in Bright Data Scraper Studio using our 29-feed target dataset and custom Scraper Studio interaction/parser code, and connecting it to DriftWatch.

---

## Architecture Overview & Code References

DriftWatch integrates with Bright Data Scraper Studio (Data Collector API - DCA) using a universal multi-ecosystem collector architecture. All collector configurations, scripts, target CSV datasets, and backend integration code are versioned in the codebase:

| Component | Codebase File Reference | Description |
| :--- | :--- | :--- |
| **Collector Definition** | [`bright_data/collector_definition.json`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/collector_definition.json) | Collector metadata, trigger endpoint, dataset polling URL, and JSON schema contract |
| **Interaction Script** | [`bright_data/collector_interaction.js`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/collector_interaction.js) | Scraper Studio Cheerio/Puppeteer navigation, DOM wait, and collection lifecycle |
| **Universal Parser Script** | [`bright_data/collector_parser.js`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/collector_parser.js) | Multi-format parser handling HTML cards, Markdown headings, and RST changelogs with automated ecosystem detection |
| **29 Feeds Target CSV** | [`bright_data/target_urls_29.csv`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/target_urls_29.csv) | Batch input CSV with all 29 target documentation and changelog URLs |
| **Example DCA Output** | [`bright_data/example_structured_output.json`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/example_structured_output.json) | Sample validated JSON records returned by Scraper Studio |
| **Backend DCA Engine** | [`backend/scraper.py`](file:///Users/vikramlingam/Desktop/Hackathon/backend/scraper.py) | API trigger (`trigger_scrape`), async polling (`poll_results`), and JSON/JSONL stream decoding |
| **Frontend Target Map** | [`frontend/types/index.ts`](file:///Users/vikramlingam/Desktop/Hackathon/frontend/types/index.ts) | Canonical `TARGET_URL_MAP` associating the 29 documentation nodes with radar sweeps |

---

## Step 1: Create a Bright Data Account

1. Go to [https://brightdata.com](https://brightdata.com) and create an account or sign in.
2. Navigate to your dashboard at [https://brightdata.com/cp](https://brightdata.com/cp).

---

## Step 2: Get Your API Token

1. Click on your profile icon in the bottom-left corner of the Bright Data control panel.
2. Select **Account Settings**.
3. Under the **API Tokens** section, click **Add API Token** (or copy an existing token).
4. Save this token. This will be your `BRIGHT_DATA_API_TOKEN`.

---

## Step 3: Create the Universal Scraper Studio Collector

1. In the left navigation sidebar, click on **Scraping Solutions** &rarr; **Scraper Studio** (or **Data Collector**).
2. Click **Create Scraper** / **Add Scraper**.
3. Choose **Scraper Studio (IDE / Custom Code Mode)**.
4. Name your collector: `universal-docs-changelog`.

### 3.1 Input Schema & Target URL CSV
Upload or paste the 29 target URLs from [`bright_data/target_urls_29.csv`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/target_urls_29.csv) as your input dataset. The input schema requires a `url` parameter:

```json
{
  "url": {
    "type": "string",
    "default": "https://docs.stripe.com/changelog",
    "description": "Target documentation or changelog URL"
  }
}
```

The 29 monitored ecosystem nodes in [`bright_data/target_urls_29.csv`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/target_urls_29.csv) cover:
- **AI Agent Frameworks**: LangChain Core, LangGraph, CrewAI, Instructor
- **LLM Runtimes & Gateways**: OpenAI SDK, Anthropic SDK, LiteLLM, DSPy, vLLM, Ollama
- **Vector DBs & Search**: ChromaDB, Qdrant, Weaviate, Pinecone
- **Protocols & Schemas**: Model Context Protocol (MCP Specification)
- **Web & Fullstack Frameworks**: Next.js 15 & React 19, Astro, Bun, Tailwind CSS v4
- **Data & Backends**: Pydantic v2, Prisma ORM, Drizzle ORM, Supabase, FastAPI
- **Cloud & Enterprise APIs**: Stripe, AWS (Boto3), GCP (Google Cloud GenAI)

### 3.2 Interaction Code
In the Scraper Studio **Interaction** tab, paste the code from [`bright_data/collector_interaction.js`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/collector_interaction.js):

```javascript
/* Bright Data Scraper Studio interaction code */
navigate(input.url);
wait('body');
collect(parse());
```

### 3.3 Parser Code
In the Scraper Studio **Parser** tab, paste the universal Cheerio parser from [`bright_data/collector_parser.js`](file:///Users/vikramlingam/Desktop/Hackathon/bright_data/collector_parser.js).

This parser dynamically classifies changes into DriftWatch schema contracts (`BREAKING_CHANGE`, `DEPRECATION`, `TOOL_SCHEMA_CHANGE`, `FEATURE_UPDATE`), detects ecosystems from URLs, and extracts backticked code tokens and method signatures:

```javascript
/* Bright Data Scraper Studio universal parser */
const targetUrl = (typeof input !== 'undefined' && input && input.url)
  ? String(input.url).trim()
  : (typeof location !== 'undefined' && location.href)
    ? String(location.href).trim()
    : '';

if (!targetUrl || !targetUrl.startsWith('http')) {
  throw new Error('Bright Data Collector Parser error: Missing or invalid required input.url parameter.');
}

function ecosystemFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('stripe')) return 'Stripe';
    if (host.includes('openai')) return 'OpenAI';
    if (host.includes('anthropic')) return 'Anthropic';
    if (host.includes('langchain')) return 'LangChain';
    if (host.includes('fastapi')) return 'FastAPI';
    if (host.includes('supabase')) return 'Supabase';
    return host.split('.')[0] ? host.split('.')[0].toUpperCase() : 'Documentation';
  } catch (_) { return 'Documentation'; }
}

function classify(text) {
  const lower = text.toLowerCase();
  if (/breaking|removed|no longer|deleted|dropped|incompatible/.test(lower)) return { category: 'BREAKING_CHANGE', urgency: 'HIGH' };
  if (/deprecat|sunset|obsolete|discontinued|phase out/.test(lower)) return { category: 'DEPRECATION', urgency: 'MEDIUM' };
  if (/schema|tool|parameter|mcp|protocol|argument|signature|function call/.test(lower)) return { category: 'TOOL_SCHEMA_CHANGE', urgency: 'MEDIUM' };
  return { category: 'FEATURE_UPDATE', urgency: 'LOW' };
}

function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

function recordFor(title, summary, code, ecosystem) {
  const cleanTitle = clean(title).slice(0, 120);
  const cleanSummary = clean(summary).slice(0, 450);
  if (cleanTitle.length < 3 || cleanSummary.length < 5) return null;
  const classification = classify(cleanTitle + ' ' + cleanSummary);
  const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
  return {
    entry_id: ecosystem.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + slug,
    ecosystem: ecosystem,
    title: cleanTitle,
    category: classification.category,
    urgency: classification.urgency,
    plain_summary: cleanSummary,
    affected_code: code.slice(0, 10),
    source_url: targetUrl,
    discovered_at: new Date().toISOString()
  };
}

const ecosystem = ecosystemFor(targetUrl);
const entries = [];
const seen = {};
const bodyText = String($('body').text() || '').trim();

// Markdown/raw GitHub pages expose release sections in body text
if (/\.md(?:$|\?)|raw\.githubusercontent\.com/i.test(targetUrl) || /^#/.test(bodyText)) {
  const sections = bodyText.split(/\n##\s+/);
  sections.slice(1, 31).forEach((section) => {
    const lines = section.split('\n').map(clean).filter(Boolean);
    if (!lines.length) return;
    const title = lines[0].replace(/^[-*#\s]+/, '');
    const summary = lines.slice(1).join(' ');
    const code = (title + ' ' + summary).match(/`([^`]+)`/g) || [];
    const record = recordFor(title, summary, code.map((item) => item.replace(/`/g, '')), ecosystem);
    if (record && !seen[record.entry_id]) { seen[record.entry_id] = true; entries.push(record); }
  });
}

// Generic HTML fallback covers article/card-based changelogs
if (!entries.length) {
  $('article, section, [class*="Changelog"], [class*="changelog"], [class*="release-note"], [class*="releaseNote"], [class*="entry"]').each((_, element) => {
    const el = $(element);
    const title = clean(el.find('h1, h2, h3, h4, [class*="heading"], [class*="title"]').first().text());
    const summary = clean(el.find('p, li, [class*="description"], [class*="content"]').text()) || clean(el.text());
    const code = [];
    el.find('code, pre').each((__, node) => {
      const token = clean($(node).text()).replace(/`/g, '');
      if (token && token.length > 2 && code.indexOf(token) === -1) code.push(token);
    });
    const record = recordFor(title, summary, code, ecosystem);
    if (record && !seen[record.entry_id]) { seen[record.entry_id] = true; entries.push(record); }
  });
}

return entries;
```

4. Click **Save Scraper** and locate your **Collector ID** (e.g. `c_mt2slsnef0likmk7o`).

---

## Step 4: Save Credentials in your `.env` File

1. In your local DriftWatch project root, configure your `.env`:
   ```ini
   BRIGHT_DATA_API_TOKEN=your_real_api_token_here
   BRIGHT_DATA_COLLECTOR_ID=c_mt2slsnef0likmk7o
   DATABASE_PATH=driftwatch.db
   DEFAULT_TARGET_URLS=https://docs.stripe.com/changelog
   FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```
2. Replace `your_real_api_token_here` with your Bright Data API token.
3. Keep `BRIGHT_DATA_COLLECTOR_ID` set to your Scraper Studio collector ID (`c_mt2slsnef0likmk7o`).

---

## Step 5: Authenticate the Bright Data CLI

To enable AI self-healing repairs from your machine or terminal, log in to the Bright Data CLI:

```bash
npx @brightdata/cli bdata login
```

Follow the prompt to paste your API token. This authenticates the local CLI so DriftWatch can run `bdata scraper heal` and `bdata scraper approve` commands automatically.

---

## Step 6: Test Your Collector with DriftWatch

Once configured, verify your setup from the terminal.

### 1. Test Single-Feed Data Collection
```bash
python3 -m backend.cli scan --url https://docs.stripe.com/changelog --engine bright_data_dca
```
You will see:
- Engine Used: `bright_data_dca`
- Bright Data Job ID: `job_...`
- Validated items saved to SQLite database

### 2. Test Multi-Node 29 Feeds Batch Run
Trigger the scraper across all 29 feeds via the dashboard's **Scan All Docs** button or CLI:
```bash
python3 -m backend.cli scan --engine bright_data_dca
```
The backend `trigger_scrape` in [`backend/scraper.py`](file:///Users/vikramlingam/Desktop/Hackathon/backend/scraper.py) submits the batch payload `[{"url": ...}]` to Scraper Studio, polls the dataset endpoint, and seamlessly ingests records into DriftWatch.

### 3. Test the 4-Stage Self-Healing Lifecycle
```bash
python3 -m backend.cli heal --url https://docs.stripe.com/changelog
```
This executes:
1. Diagnosis on the target URL
2. `bdata scraper heal`
3. `bdata scraper approve`
4. Post-heal verification re-run with `force_engine="bright_data_dca"`
5. Verifiable Proof-of-Recovery Evidence Report output with SHA-256 fingerprint
