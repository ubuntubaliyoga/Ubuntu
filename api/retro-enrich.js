// api/retro-enrich.js
// One-shot: fetch today's leadgen entries from Notion CRM, run phone enrichment,
// update Notion, and return a results table.
// GET /api/retro-enrich?dry=1  → report only, no Notion writes
// GET /api/retro-enrich        → enrich + update Notion

export const config = { maxDuration: 120 };

import {
  extractPhoneFromText,
  isLinkInBioUrl, extractAllLinkInBio, shortUrl,
  scrapeLinkInBio, fetchContactDeep, braveSearchPhone,
} from '../lib/enrich-helpers.js';

const CRM_DB_ID  = '34a622d3e57481738b3ce70824a6adf7';
const NOTION_VER = '2022-06-28';

export default async function handler(req, res) {
  const dry  = req.query?.dry === '1';
  const _log = [];
  const log  = (msg) => { console.log('[retro-enrich]', msg); _log.push(msg); };

  try {
    const today = new Date().toISOString().slice(0, 10);
    log(`Fetching today's leads (${today}) from Notion CRM…`);

    const leads    = await fetchTodaysLeads(today, log);
    const hadPhone = leads.filter(l => l.phone).length;
    log(`Found ${leads.length} leads — ${hadPhone} already have a phone, enriching ${leads.length - hadPhone}`);

    const rows = [];
    for (const lead of leads) {
      if (lead.phone) { rows.push({ name: lead.name, insta: lead.insta, phone: lead.phone, source: 'already had', updated: false }); continue; }
      const result = await enrichOne(lead, log);
      if (result) {
        if (!dry) await updateNotionPhone(lead.pageId, result.phone);
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

async function fetchTodaysLeads(today, log) {
  const leads = [];
  let cursor;
  do {
    const body = { filter: { property: 'Engaged first', date: { equals: today } }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB_ID}/query`, { method: 'POST', headers: notionHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (d.object === 'error') throw new Error(`Notion: ${d.message}`);
    for (const page of d.results || []) {
      const p = page.properties;
      leads.push({ pageId: page.id, name: p['Name']?.title?.[0]?.plain_text || '', insta: p['Insta']?.rich_text?.[0]?.plain_text || null, website: p['Website']?.rich_text?.[0]?.plain_text || null, phone: p['Whatsapp']?.rich_text?.[0]?.plain_text || null, email: p['Email']?.email || null, bio: '', _posts: [], location: p['Location']?.rich_text?.[0]?.plain_text || null });
    }
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return leads;
}

async function updateNotionPhone(pageId, phone) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers: notionHeaders(),
    body: JSON.stringify({ properties: { 'Whatsapp': { rich_text: [{ text: { content: phone } }] } } }),
  });
}

async function enrichOne(l, log) {
  // ① Instagram post captions
  const captions = (l._posts || []).map(p => p.caption || p.text || '').join(' ');
  const capPhone = extractPhoneFromText(captions);
  if (capPhone) return { phone: capPhone, source: 'Instagram caption' };

  // ② Link-in-bio services
  for (const url of extractAllLinkInBio(l.website, l.bio)) {
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

function notionHeaders() {
  return { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': NOTION_VER };
}
