// api/retro-enrich.js
// One-shot: fetch today's leadgen entries from Notion CRM, run phone enrichment,
// update Notion, and return a results table.
// GET /api/retro-enrich?dry=1  → report only, no Notion writes
// GET /api/retro-enrich        → enrich + update Notion

export const config = { maxDuration: 120 };

const CRM_DB_ID  = '34a622d3e57481738b3ce70824a6adf7';
const NOTION_VER = '2022-06-28';

export default async function handler(req, res) {
  const dry = req.query?.dry === '1';
  const _log = [];
  const log  = (msg) => { console.log('[retro-enrich]', msg); _log.push(msg); };

  try {
    const today = new Date().toISOString().slice(0, 10);
    log(`Fetching today's leads (${today}) from Notion CRM…`);

    // ── Query Notion: leads where "Engaged first" = today ──────────────────────
    const leads = await fetchTodaysLeads(today, log);
    log(`Found ${leads.length} leads from today`);

    if (!leads.length) {
      return res.json({ message: 'No leads found for today', rows: [], _log });
    }

    const noPhone = leads.filter(l => !l.phone);
    const hadPhone = leads.filter(l => l.phone).length;
    log(`${hadPhone} already have a phone, enriching ${noPhone.length} without`);

    // ── Run enrichment ─────────────────────────────────────────────────────────
    const rows = [];
    for (const lead of leads) {
      if (lead.phone) {
        rows.push({ name: lead.name, insta: lead.insta, phone: lead.phone, source: 'already had', updated: false });
        continue;
      }
      const before = null;
      const result = await enrichOne(lead, log);
      if (result) {
        log(`✅ ${lead.name}: ${result.phone} via ${result.source}`);
        if (!dry) {
          await updateNotionPhone(lead.pageId, result.phone);
          log(`   → Updated Notion page ${lead.pageId}`);
        }
        rows.push({ name: lead.name, insta: lead.insta, phone: result.phone, source: result.source, updated: !dry });
      } else {
        rows.push({ name: lead.name, insta: lead.insta, phone: null, source: '—', updated: false });
      }
    }

    const found   = rows.filter(r => r.source !== '—' && r.source !== 'already had').length;
    const updated = rows.filter(r => r.updated).length;
    log(`Done: ${found} new numbers found, ${updated} Notion pages updated`);

    res.json({ today, total: leads.length, hadPhone, found, updated, dry, rows, _log });
  } catch (err) {
    console.error('retro-enrich:', err);
    res.status(500).json({ error: err.message, _log });
  }
}

// ── Fetch today's leads from CRM ──────────────────────────────────────────────
async function fetchTodaysLeads(today, log) {
  let leads = [];
  let cursor;
  do {
    const body = {
      filter: { property: 'Engaged first', date: { equals: today } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.object === 'error') throw new Error(`Notion: ${d.message}`);
    for (const page of d.results || []) {
      const props = page.properties;
      leads.push({
        pageId:  page.id,
        name:    props['Name']?.title?.[0]?.plain_text || '',
        insta:   props['Insta']?.rich_text?.[0]?.plain_text || null,
        website: props['Website']?.rich_text?.[0]?.plain_text || null,
        phone:   props['Whatsapp']?.rich_text?.[0]?.plain_text || null,
        email:   props['Email']?.email || null,
        bio:     '',   // not stored in CRM
        _posts:  [],
        location: props['Location']?.rich_text?.[0]?.plain_text || null,
      });
    }
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return leads;
}

// ── Update Notion page with found phone ───────────────────────────────────────
async function updateNotionPhone(pageId, phone) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: { 'Whatsapp': { rich_text: [{ text: { content: phone } }] } },
    }),
  });
}

// ── Phone enrichment (copied + adapted from leadgen-agent.js) ─────────────────
async function enrichOne(l, log) {
  // ① Instagram post captions
  const captions = (l._posts || []).map(p => p.caption || p.text || '').join(' ');
  const capPhone = extractPhoneFromText(captions);
  if (capPhone) return { phone: capPhone, source: 'Instagram caption' };

  // ② Link-in-bio services
  const bioUrls = extractAllLinkInBio(l.website, l.bio);
  for (const url of bioUrls) {
    const phone = await scrapeLinkInBio(url);
    if (phone) return { phone, source: shortUrl(url) };
  }

  // ③ Website deep scrape
  if (l.website && !isLinkInBioUrl(l.website)) {
    const result = await fetchContactDeep(l.website);
    if (result?.phone) return { phone: result.phone, source: `website ${result.page}` };
  }

  // ④ Brave Search
  if (process.env.BRAVE_API_KEY) {
    const phone = await braveSearchPhone(l.name, l.insta, l.location);
    if (phone) return { phone, source: 'Brave Search' };
  }

  return null;
}

// ── Helpers (duplicated from leadgen-agent.js) ────────────────────────────────
function extractPhoneFromText(text) {
  if (!text) return null;
  const waM = text.match(/wa\.me\/\+?([\d]{7,15})/);
  if (waM) return waM[1];
  const waApi = text.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
  if (waApi) return waApi[1];
  return text.match(/\+[\d][\d\s\-().]{8,14}[\d]/)?.[0]?.replace(/[\s\-()]/g, '') || null;
}

function extractPhoneFromHtml(html) {
  const telM = html.match(/href="tel:(\+?[\d\s\-().+]{7,20})"/i);
  if (telM) return telM[1].replace(/[\s\-().]/g, '');
  const waM = html.match(/wa\.me\/\+?([\d]{7,15})/);
  if (waM) return waM[1];
  const waApi = html.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
  if (waApi) return waApi[1];
  const intl = html.match(/\+[\d][\d\s\-().]{8,14}[\d]/)?.[0];
  if (intl) return intl.replace(/[\s\-()]/g, '');
  const labeled = html.match(/(?:tel|phone|whatsapp|wa|mob(?:ile)?|call|contact|hp)[:\s 📞]+(\+?[\d][\d\s\-().]{7,14}[\d])/i);
  if (labeled) return labeled[1].replace(/[\s\-().]/g, '');
  return null;
}

const LINK_IN_BIO_DOMAINS = [
  'linktr.ee','beacons.ai','taplink.cc','bio.fm','campsite.bio',
  'lnk.bio','flow.page','milkshake.app','linkinbio.at','later.com',
  'bento.me','bio.link','carrd.co',
];
function isLinkInBioUrl(url) {
  return !!url && LINK_IN_BIO_DOMAINS.some(d => url.includes(d));
}
function extractAllLinkInBio(website, bio) {
  const text = `${website || ''} ${bio || ''}`;
  const found = [];
  for (const d of LINK_IN_BIO_DOMAINS) {
    const re = new RegExp(`(?:https?:\\/\\/)?${d.replace('.','\\.')}[\\/#][\\w.\\-]+`, 'gi');
    const m  = text.match(re);
    if (m) found.push(...m.map(u => u.startsWith('http') ? u : `https://${u}`));
  }
  return [...new Set(found)];
}
function shortUrl(url) { try { return new URL(url).hostname; } catch { return url; } }

async function scrapeLinkInBio(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await r.text();
    const waM   = html.match(/wa\.me\/\+?([\d]{7,15})/);
    if (waM) return waM[1];
    const waApi = html.match(/api\.whatsapp\.com\/send[^"'\s]*[?&]phone=\+?([\d]{7,15})/i);
    if (waApi) return waApi[1];
    const telM  = html.match(/href="tel:(\+?[\d\s\-().+]{7,20})"/i);
    if (telM)  return telM[1].replace(/[\s\-().]/g, '');
    const ndM   = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (ndM) {
      const ndStr = ndM[1];
      const ndWa  = ndStr.match(/wa\.me\\?\/\+?([\d]{7,15})/);
      if (ndWa) return ndWa[1];
      const ndApi = ndStr.match(/api\.whatsapp\.com\\?\/send[^"'\s\\]*[?&]phone=\+?([\d]{7,15})/i);
      if (ndApi) return ndApi[1];
      try {
        const nd = JSON.parse(ndStr);
        const findLinks = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj)) { for (const x of obj) { const r = findLinks(x); if (r) return r; } return null; }
          const href = (obj.url || obj.href || obj.link || '').trim();
          if (href.startsWith('tel:')) return href.slice(4).replace(/[\s\-]/g,'');
          const tP = (obj.title || obj.label || '').match(/\+[\d]{8,14}/)?.[0];
          if (tP) return tP.replace(/\s/g,'');
          for (const v of Object.values(obj)) { const r = findLinks(v); if (r) return r; }
          return null;
        };
        const found = findLinks(nd);
        if (found) return found;
      } catch { /* fall through */ }
    }
    return null;
  } catch { return null; }
}

async function fetchContactDeep(website) {
  const base  = website.replace(/\/$/, '');
  const PAGES = ['', '/contact', '/about', '/impressum', '/imprint', '/legal', '/kontakt', '/book', '/schedule', '/workshop'];
  const UA    = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const results = await Promise.allSettled(PAGES.map(async suffix => {
    try {
      const r    = await fetch(`${base}${suffix}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
      const html = await r.text();
      const phone = extractPhoneFromHtml(html);
      const email = html.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0] || null;
      if (phone || email) return { phone, email, page: suffix || '/' };
    } catch { /* skip */ }
    return null;
  }));
  for (const r of results) { if (r.status === 'fulfilled' && r.value?.phone) return r.value; }
  for (const r of results) { if (r.status === 'fulfilled' && r.value?.email) return r.value; }
  return null;
}

async function braveSearchPhone(name, insta, city) {
  const handle = (insta || '').replace('@', '');
  const q = `"${name}" OR "@${handle}" yoga retreat WhatsApp ${city || ''}`.trim();
  try {
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
        signal: AbortSignal.timeout(8000) }
    );
    const d    = await r.json();
    const text = (d.web?.results || []).map(x => x.description || '').join(' ');
    return extractPhoneFromText(text);
  } catch { return null; }
}

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VER,
  };
}
