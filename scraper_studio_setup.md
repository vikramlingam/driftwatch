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
/* Bright Data Scraper Studio universal Cheerio/DOM parser */
// 1. Safe target URL resolution (never throws in Cheerio sandbox)
var targetUrl = '';
try {
  if (typeof input !== 'undefined' && input && input.url) {
    targetUrl = String(input.url).trim();
  } else if (typeof location !== 'undefined' && location && location.href) {
    targetUrl = String(location.href).trim();
  }
} catch (_) {
  targetUrl = '';
}
if (!targetUrl || !targetUrl.startsWith('http')) {
  targetUrl = 'https://universal-docs.driftwatch.io/feed';
}

function ecosystemFor(url) {
  try {
    var lower = String(url || '').toLowerCase();
    if (lower.includes('stripe')) return 'Stripe';
    if (lower.includes('openai')) return 'OpenAI';
    if (lower.includes('anthropic')) return 'Anthropic';
    if (lower.includes('langgraph')) return 'LangGraph (Stateful)';
    if (lower.includes('langchain')) return 'LangChain & Agents';
    if (lower.includes('crewai')) return 'CrewAI & Multi-Agent';
    if (lower.includes('litellm')) return 'LiteLLM (AI Gateway)';
    if (lower.includes('dspy')) return 'DSPy (Prompt Optimizer)';
    if (lower.includes('vllm')) return 'vLLM (Inference Engine)';
    if (lower.includes('transformers') || lower.includes('huggingface')) return 'Hugging Face Transformers';
    if (lower.includes('instructor') || lower.includes('jxnl')) return 'Instructor (Structured LLM)';
    if (lower.includes('llama_index') || lower.includes('llama-index')) return 'LlamaIndex & RAG';
    if (lower.includes('ollama')) return 'Ollama & Local LLMs';
    if (lower.includes('chroma')) return 'ChromaDB Vector';
    if (lower.includes('qdrant')) return 'Qdrant Vector Engine';
    if (lower.includes('weaviate')) return 'Weaviate Vector DB';
    if (lower.includes('pinecone')) return 'Pinecone Vector';
    if (lower.includes('modelcontextprotocol') || lower.includes('/mcp')) return 'MCP & Agent Tools';
    if (lower.includes('next.js') || lower.includes('vercel/next')) return 'Next.js 15 & React 19';
    if (lower.includes('astro')) return 'Astro Web Framework';
    if (lower.includes('tailwind')) return 'Tailwind CSS v4';
    if (lower.includes('pydantic')) return 'Pydantic v2';
    if (lower.includes('prisma')) return 'Prisma ORM';
    if (lower.includes('drizzle')) return 'Drizzle ORM';
    if (lower.includes('bun')) return 'Bun Runtime';
    if (lower.includes('supabase')) return 'Supabase';
    if (lower.includes('fastapi')) return 'FastAPI';
    if (lower.includes('boto3') || lower.includes('boto/')) return 'AWS (Boto3)';
    if (lower.includes('genai') || lower.includes('googleapis')) return 'GCP (GenAI)';

    var host = (new URL(url)).hostname.replace(/^www\./, '').toLowerCase();
    return host.split('.')[0] ? host.split('.')[0].toUpperCase() : 'Documentation';
  } catch (_) {
    return 'Documentation';
  }
}
// (See full parser implementation in bright_data/collector_parser.js)
```

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
