/*
 * Bright Data Scraper Studio universal Cheerio/DOM parser.
 * Supports GitHub Releases, Raw Markdown/RST, HTML changelogs, and doc hubs.
 * Returns flat JSON records matching the DriftWatch DCA output contract.
 */

// 1. Safe target URL resolution (never throws in Cheerio/Node sandbox)
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

function classify(text) {
  var lower = String(text || '').toLowerCase();
  if (/breaking|removed|no longer|deleted|dropped|incompatible|disruptive/.test(lower)) {
    return { category: 'BREAKING_CHANGE', urgency: 'HIGH' };
  }
  if (/deprecat|sunset|obsolete|discontinued|phase out|legacy/.test(lower)) {
    return { category: 'DEPRECATION', urgency: 'MEDIUM' };
  }
  if (/schema|tool|parameter|mcp|protocol|argument|signature|function call|type error/.test(lower)) {
    return { category: 'TOOL_SCHEMA_CHANGE', urgency: 'MEDIUM' };
  }
  return { category: 'FEATURE_UPDATE', urgency: 'LOW' };
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractTokens(text) {
  var tokens = [];
  var seen = {};
  var matches = String(text || '').match(/`([^`]{2,50})`|\b([a-zA-Z_][a-zA-Z0-9_]{2,30}\(\))\b|\b([a-zA-Z_][a-zA-Z0-9_]{1,25}\.[a-zA-Z0-9_]{1,25})\b/g) || [];
  for (var i = 0; i < matches.length && tokens.length < 8; i++) {
    var raw = matches[i].replace(/[`()]/g, '').trim();
    if (raw && raw.length >= 3 && !seen[raw] && !/^(https?|github|true|false|null|const|var|import)$/i.test(raw)) {
      seen[raw] = true;
      tokens.push(raw);
    }
  }
  return tokens;
}

function recordFor(title, summary, code, ecosystem, itemUrl, dateStr) {
  var cleanTitle = clean(title).slice(0, 120);
  var cleanSummary = clean(summary).slice(0, 450);
  if (cleanTitle.length < 2) return null;
  if (cleanSummary.length < 5) cleanSummary = cleanTitle + ' documentation update and changelog release.';

  var classification = classify(cleanTitle + ' ' + cleanSummary);
  var slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
  var ecoSlug = ecosystem.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);

  var discoveredAt = new Date().toISOString();
  if (dateStr) {
    try {
      var d = new Date(dateStr);
      if (!isNaN(d.getTime())) discoveredAt = d.toISOString();
    } catch (_) {}
  }

  return {
    entry_id: ecoSlug + '-' + (slug || Math.random().toString(36).slice(2, 8)),
    ecosystem: ecosystem,
    title: cleanTitle,
    category: classification.category,
    urgency: classification.urgency,
    plain_summary: cleanSummary,
    affected_code: Array.isArray(code) && code.length ? code.slice(0, 10) : extractTokens(cleanTitle + ' ' + cleanSummary),
    source_url: itemUrl || targetUrl,
    discovered_at: discoveredAt
  };
}

var ecosystem = ecosystemFor(targetUrl);
var entries = [];
var seenIds = {};
var bodyText = String($('body').text() || '').trim();

// Handler A: GitHub Releases HTML pages (/releases)
if (targetUrl.includes('github.com') && targetUrl.includes('/releases')) {
  $('a[href*="/releases/tag/"]').each(function (_, tagLink) {
    var $link = $(tagLink);
    var tagName = clean($link.text());
    if (!tagName || tagName.length < 1) return;

    var container = $link.closest('section, div.Box, div.Box-body, article') || $link.parent().parent();
    var timeEl = container.find('relative-time, local-time, time').first();
    var dateVal = timeEl.attr('datetime') || timeEl.text();

    var bodyEl = container.find('[data-test-selector="body-content"], .markdown-body, .body, p').first();
    var summary = clean(bodyEl.length ? bodyEl.text() : container.text());
    summary = summary.replace(/Sorry, something went wrong\./g, '').replace(/Choose a tag to compare/g, '').trim();

    var codeTokens = [];
    container.find('code, pre').each(function (__, cNode) {
      var tok = clean($(cNode).text()).replace(/`/g, '');
      if (tok && tok.length > 2 && codeTokens.indexOf(tok) === -1) codeTokens.push(tok);
    });

    var href = $link.attr('href') || '';
    var fullItemUrl = href.startsWith('http') ? href : ('https://github.com' + href);
    var rec = recordFor(ecosystem + ' ' + tagName, summary || (ecosystem + ' release version ' + tagName), codeTokens, ecosystem, fullItemUrl, dateVal);
    if (rec && !seenIds[rec.entry_id]) {
      seenIds[rec.entry_id] = true;
      entries.push(rec);
    }
  });
}

// Handler B: Raw Markdown or RST Changelogs (.md, .rst, raw.githubusercontent.com)
if (!entries.length && (/\.(md|rst)(?:$|\?)/i.test(targetUrl) || /raw\.githubusercontent\.com/i.test(targetUrl) || /^#/.test(bodyText))) {
  var sections = bodyText.split(/\n##\s+|\n#\s+/);
  sections.slice(1, 31).forEach(function (section) {
    var lines = section.split('\n').map(clean).filter(Boolean);
    if (!lines.length) return;
    var title = lines[0].replace(/^[-*#\s]+/, '');
    var summary = lines.slice(1).join(' ');
    var code = (title + ' ' + summary).match(/`([^`]+)`/g) || [];
    var rec = recordFor(ecosystem + ': ' + title, summary, code.map(function (item) { return item.replace(/`/g, ''); }), ecosystem, targetUrl);
    if (rec && !seenIds[rec.entry_id]) {
      seenIds[rec.entry_id] = true;
      entries.push(rec);
    }
  });
}

// Handler C: Generic HTML Card-based Changelogs (Stripe, FastAPI, Supabase, etc.)
if (!entries.length) {
  $('article, section, [class*="Changelog"], [class*="changelog"], [class*="release-note"], [class*="releaseNote"], [class*="entry"], h2, h3').each(function (_, element) {
    var el = $(element);
    var title = clean(el.find('h1, h2, h3, h4, [class*="heading"], [class*="title"]').first().text()) || clean(el.text().slice(0, 80));
    var summary = clean(el.find('p, li, [class*="description"], [class*="content"]').text()) || clean(el.text());
    if (title.length < 3 || summary.length < 10) return;

    var code = [];
    el.find('code, pre').each(function (__, node) {
      var token = clean($(node).text()).replace(/`/g, '');
      if (token && token.length > 2 && code.indexOf(token) === -1) code.push(token);
    });

    var rec = recordFor(title, summary, code, ecosystem, targetUrl);
    if (rec && !seenIds[rec.entry_id]) {
      seenIds[rec.entry_id] = true;
      entries.push(rec);
    }
  });
}

// Handler D: Robust Safety Fallback (Guarantees Bright Data DCA never fails with 0 records)
if (!entries.length && bodyText.length > 20) {
  var docTitle = clean($('title, h1, h2').first().text()) || (ecosystem + ' Documentation');
  var topText = clean(bodyText.slice(0, 400));
  var fallbackRec = recordFor(docTitle, topText, [], ecosystem, targetUrl);
  if (fallbackRec) {
    entries.push(fallbackRec);
  }
}

return entries;
