/*
 * Bright Data Scraper Studio parser.
 * The collector input schema is { url: string }. Return flat rows matching
 * the DriftWatch DCA output contract.
 */
const targetUrl = (typeof input !== 'undefined' && input && input.url)
  ? String(input.url)
  : (typeof location !== 'undefined' && location.href)
    ? String(location.href)
    : 'https://docs.stripe.com/changelog';

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

// Markdown/raw GitHub pages expose release sections in body text.
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

// Generic HTML fallback covers article/card-based changelogs.
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
