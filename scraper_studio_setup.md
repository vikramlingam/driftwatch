# Bright Data Scraper Studio Setup Guide

This guide walks you through setting up a Bright Data Scraper Studio collector for the Stripe documentation changelog and connecting it to DriftWatch.

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

## Step 3: Create a Scraper Studio Collector

1. In the left navigation sidebar, click on **Scraping Solutions** (or **Scraper Studio** / **Data Collector**).
2. Click **Add Scraper** or **Create Scraper**.
3. Choose **Scraper Studio** (IDE / AI generation mode).
4. Name your collector (for example: `stripe-docs-changelog`).
5. When prompted for a starting URL or target website, enter:
   ```
   https://docs.stripe.com/changelog
   ```
6. In the AI prompt / schema builder, describe the fields to extract:
   ```
   Extract changelog entries with the following fields:
   - title: the release header or version
   - plain_summary: summary description of the release
   - category: BREAKING_CHANGE, DEPRECATION, or FEATURE_UPDATE
   - urgency: HIGH, MEDIUM, or LOW
   - affected_code: list of method names or API identifiers mentioned
   - source_url: https://docs.stripe.com/changelog
   ```
7. Click **Generate Scraper** or save the collector script.
8. Once saved, click on the collector details page to find your **Collector ID**.
   The Collector ID usually looks like:
   ```
   c_mszrbi1u1hs5ef50n3
   ```
   (or starts with `c_` followed by letters and numbers).

---

## Step 4: Save Credentials in your `.env` File

1. In your local DriftWatch project root, copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in your text editor:
   ```ini
   BRIGHT_DATA_API_TOKEN=your_real_api_token_here
   BRIGHT_DATA_COLLECTOR_ID=c_your_real_collector_id_here
   DATABASE_PATH=driftwatch.db
   DEFAULT_TARGET_URLS=https://docs.stripe.com/changelog
   FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```
3. Replace `your_real_api_token_here` with your Bright Data API token from Step 2.
4. Replace `c_your_real_collector_id_here` with your Collector ID from Step 3.

---

## Step 5: Authenticate the Bright Data CLI

To enable AI self-healing repairs from your machine or terminal, log in to the Bright Data CLI:

```bash
npx @brightdata/cli bdata login
```

Follow the prompt to paste your API token. This authenticates the local CLI so DriftWatch can run `bdata scraper heal` and `bdata scraper approve` commands automatically.

---

## Step 6: Test Your Collector with DriftWatch

Once configured, verify your setup from the terminal. Keep `.env` local and never commit the token.

### 1. Test Data Collection
```bash
python3 -m backend.cli scan --url https://docs.stripe.com/changelog --engine bright_data_dca
```
You should see:
- Engine Used: `bright_data_dca`
- Bright Data Job ID: `job_...`
- Valid items saved to SQLite

`bright_data_dca` is strict: if the token or collector ID is missing, the command reports a pipeline error rather than silently switching to direct scraping. The default `auto` engine uses Bright Data when configured and direct-scrapes any requested feeds not represented in the DCA response. A run that uses both reports `execution_engine: mixed`.

All scrape targets must be public HTTP(S) URLs. The API rejects credentials in URLs, local/private network addresses, government domains, and military domains.

### 2. Test the 4-Stage Self-Healing Lifecycle
```bash
python3 -m backend.cli heal --url https://docs.stripe.com/changelog
```
This executes:
1. Diagnosis on the target URL
2. `bdata scraper heal`
3. `bdata scraper approve`
4. Post-heal verification re-run with `force_engine="bright_data_dca"`
5. Proof-of-Recovery Evidence Report output with SHA-256 digest

The local API is loopback-only. Run the one-click launcher with `./run.sh`; it starts FastAPI on `127.0.0.1:8000` and Next.js on `localhost:3000`.
