/**
 * Bright Data Scraper Studio Custom Parser Script
 * Collector ID: c_mszrbi1u1hs5ef50n3
 * Target: https://docs.stripe.com/changelog
 */

function parse($, context) {
  const items = [];
  const sourceUrl = context.url || 'https://docs.stripe.com/changelog';

  // Iterate over each changelog article / section in the Stripe documentation DOM
  $('article, section, div[class*="ChangelogEntry"], div[class*="release-note"]').each((index, element) => {
    const el = $(element);
    
    // Extract authentic title or version heading
    const title = el.find('h1, h2, h3, [class*="heading"]').first().text().trim();
    if (!title || title.length < 3) return;

    // Extract summary text
    const paragraphs = [];
    el.find('p, li').each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 5) paragraphs.push(text);
    });
    const plainSummary = paragraphs.join(' ');
    if (!plainSummary || plainSummary.length < 10) return;

    // Extract code tokens (backticks, code elements, method signatures)
    const affectedCode = [];
    el.find('code, pre, [class*="inline-code"]').each((_, c) => {
      const token = $(c).text().trim().replace(/[`]/g, '');
      if (token && token.length > 2 && !affectedCode.includes(token)) {
        affectedCode.push(token);
      }
    });

    // Classify category and urgency based on schema contracts
    const lower = (title + ' ' + plainSummary).toLowerCase();
    let category = 'FEATURE_UPDATE';
    let urgency = 'LOW';

    if (/breaking|removed|no longer|deleted|dropped|incompatible/.test(lower)) {
      category = 'BREAKING_CHANGE';
      urgency = 'HIGH';
    } else if (/deprecat|sunset|obsolete|discontinued|phase out/.test(lower)) {
      category = 'DEPRECATION';
      urgency = 'MEDIUM';
    } else if (/schema|tool|parameter|mcp|protocol|argument|signature|function call/.test(lower)) {
      category = 'TOOL_SCHEMA_CHANGE';
      urgency = 'MEDIUM';
    }

    // Generate deterministic entry ID
    const cleanId = 'stripe-' + (title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 35));

    items.push({
      entry_id: cleanId,
      ecosystem: 'Stripe',
      title: title,
      category: category,
      urgency: urgency,
      plain_summary: plainSummary,
      affected_code: affectedCode.slice(0, 10),
      source_url: sourceUrl,
      discovered_at: new Date().toISOString()
    });
  });

  return items;
}

module.exports = { parse };
