// api/leadgen-agent.js
// Ubuntu Bali — Lead Research & Notion Sync
// POST { city }                  → B1: blocklist → B2: Instagram/Maps → enrichment → Notion write
// POST { action:'retro-enrich' } → re-run phone enrichment on today's leads (was api/retro-enrich.js)
// GET  ?action=retro-enrich      → same, ?dry=1 for preview

export const config = { maxDuration: 120 };

import {
  extractPhoneFromText, extractPhoneFromHtml,
  isLinkInBioUrl, extractAllLinkInBio, shortUrl,
  scrapeLinkInBio, fetchContactDeep, braveSearchPhone,
} from '../lib/enrich-helpers.js';

const BLOCKLIST_PAGE_ID = '333622d3-e574-8159-b0d7-d4998af4cf2c';
const CRM_DB_ID         = '34a622d3e57481738b3ce70824a6adf7';
const NOTION_VER        = '2022-06-28';

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // GET: retro-enrich
  if (req.method === 'GET') {
    if (req.query?.action === 'retro-enrich') return handleRetroEnrich(req, res);
    return res.status(400).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  // POST: retro-enrich action
  if (req.body?.action === 'retro-enrich') return handleRetroEnrich(req, res);

  const { city } = req.body;
  if (!city?.trim()) return res.status(400).json({ error: 'city required' });

  const _log = []; // diagnostic trace returned to frontend
  const log  = (msg) => { console.log('[leadgen]', msg); _log.push(msg); };

  try {
    log('B1: fetching blocklist');
    const blocklist = await fetchBlocklist();
    log(`B1: blocklist has ${blocklist.size} entries`);

    log('B2: starting research');
    let leads = await b2Research(city, log);
    log(`B2: found ${leads.length} candidates from search`);

    if (leads.length < 10) {
      log(`Maps fallback: need ${13 - leads.length} more`);
      const extra = await googleMapsLeads(city, 13 - leads.length, log);
      log(`Maps: returned ${extra.length} places`);
      leads = mergeDedupe(leads, extra);
    }

    leads = filterBlocklist(leads, blocklist).slice(0, 10);
    log(`After blocklist filter: ${leads.length} leads`);

    leads = await enrichContacts(leads, log);
    leads = await claudeEnrich(leads, city, log);
    leads = leads.map(l => ({ ...l, waLink: buildWALink(l) }));

    const results = await writeToNotion(leads, city, blocklist, log);
    const newNames = results.filter(r => r.status === 'added').map(r => r.name);
    if (newNames.length) await appendBlocklist(newNames);

    log(`Done: ${results.filter(r=>r.status==='added').length} added, ${results.filter(r=>r.status==='skipped').length} skipped`);
    res.json({ leads: results, city, found: results.length, _log });
  } catch (err) {
    console.error('leadgen-agent:', err);
    _log.push('FATAL: ' + err.message);
    res.status(500).json({ error: err.message, _log });
  }
}

// ─── B1 BLOCKLIST ─────────────────────────────────────────────────────────────
async function fetchBlocklist() {
  try {
    const r = await fetch(
      `https://api.notion.com/v1/blocks/${BLOCKLIST_PAGE_ID}/children?page_size=100`,
      { headers: notionHeaders() }
    );
    const d = await r.json();
    const text = (d.results || [])
      .flatMap(b => {
        const blk = b.paragraph || b.bulleted_list_item || b.numbered_list_item || b.quote;
        return (blk?.rich_text || []).map(t => t.plain_text);
      })
      .join('');
    return new Set(text.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  } catch { return new Set(); }
}

async function appendBlocklist(names) {
  try {
    await fetch(`https://api.notion.com/v1/blocks/${BLOCKLIST_PAGE_ID}/children`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({
        children: [{ object: 'block', type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: names.join(', ') } }] } }],
      }),
    });
  } catch { /* non-critical */ }
}

function filterBlocklist(leads, blocklist) {
  return leads.filter(l => {
    const n = (l.name || '').toLowerCase();
    for (const e of blocklist) {
      if (e && (n === e || n.startsWith(e + ' ') || n.endsWith(' ' + e))) return false;
    }
    return true;
  });
}

// ─── B2 RESEARCH (Apify: Instagram hashtag search → profile scrape) ───────────
async function b2Research(city, log) {
  // Build city hashtags: yogabarcelona, retreatbarcelona, barcelonayoga
  const slug     = city.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hashtags = [`yoga${slug}`, `retreat${slug}`, `${slug}yoga`];

  log(`Instagram hashtag search: ${hashtags.join(', ')}`);
  let usernames = [];
  try {
    const posts = await apifyRun('apify~instagram-hashtag-scraper', {
      hashtags,
      resultsLimit: 60,
    });
    const seen = new Set();
    for (const p of (Array.isArray(posts) ? posts : [])) {
      const u = p.ownerUsername || p.author?.username;
      if (u && !seen.has(u)) { seen.add(u); usernames.push(u); }
    }
    log(`${Array.isArray(posts) ? posts.length : 0} posts → ${usernames.length} unique profiles`);
  } catch (e) {
    log(`Hashtag scrape failed: ${e.message.slice(0, 120)}`);
  }

  if (!usernames.length) return [];

  log(`Scraping ${Math.min(usernames.length, 20)} Instagram profiles`);
  const profiles = await instagramProfileScrape(usernames.slice(0, 20), log);
  log(`Got ${profiles.length} profiles`);

  const BIO_KW = ['yoga','retreat','meditat','wellness','workshop','teacher','trainer','facilitator','coach'];
  return profiles
    .filter(p => BIO_KW.some(k => (p.biography || '').toLowerCase().includes(k)))
    .map(p => ({
      source:    'instagram',
      name:      p.fullName || p.username || '',
      insta:     `@${p.username}`,
      website:   p.externalUrl || null,
      phone:     p.businessPhoneNumber || null,
      email:     p.businessEmail || null,
      bio:       p.biography || '',
      _posts:    p.latestPosts || p.posts || [],   // kept for caption scanning, not written to Notion
      retreat:   null,
      firstname: null,
      variant:   null,
      location:  city,
    }));
}

// ─── INSTAGRAM PROFILE SCRAPE (Apify) ────────────────────────────────────────
async function instagramProfileScrape(usernames, log) {
  if (!usernames.length) return [];
  try {
    const items = await apifyRun('apify~instagram-profile-scraper', { usernames });
    return Array.isArray(items) ? items : [];
  } catch (e) {
    log(`Instagram scrape error: ${e.message}`);
    return [];
  }
}

// ─── GOOGLE MAPS FALLBACK (Apify) ────────────────────────────────────────────
async function googleMapsLeads(city, limit, log) {
  const enc = encodeURIComponent(city);
  const max = Math.min(limit + 2, 15);
  // compass~crawler-google-places takes startUrls pointing at Google Maps searches
  const attempts = [
    {
      slug: 'compass~crawler-google-places',
      input: {
        startUrls: [
          { url: `https://www.google.com/maps/search/yoga+retreat+${enc}/` },
          { url: `https://www.google.com/maps/search/yoga+studio+${enc}/` },
        ],
        maxCrawledPlaces: max,
        language: 'en',
      },
    },
    {
      slug: 'apify~google-maps-scraper',
      input: { searchStringsArray: [`yoga retreat ${city}`, `yoga studio ${city}`], maxCrawledPlacesPerSearch: Math.ceil(max / 2), language: 'en' },
    },
  ];
  for (const { slug, input } of attempts) {
    try {
      const items = await apifyRun(slug, input);
      if (Array.isArray(items) && items.length) {
        log(`Maps: ${slug} returned ${items.length} places`);
        return items
          .filter(i => i.title || i.name)
          .map(i => ({
            source:    'google_maps',
            name:      i.title || i.name,
            website:   i.website  || null,
            insta:     null,
            phone:     i.phone    || null,
            email:     null,
            bio:       i.description || i.snippet || '',
            retreat:   null,
            firstname: null,
            variant:   null,
            location:  i.url || i.address || null,
          }));
      }
    } catch (e) {
      log(`Maps: ${slug} failed: ${e.message.slice(0, 80)}`);
    }
  }
  return [];
}

// ─── CONTACT ENRICHMENT — 5-method pipeline ──────────────────────────────────
async function enrichContacts(leads, log) {
  const needPhone = leads.filter(l => !l.phone);
  if (!needPhone.length) return leads;
  log(`Phone enrichment: ${needPhone.length} leads to check`);
  await Promise.allSettled(needPhone.map(l => enrichOne(l, log)));
  const found = leads.filter(l => l.phone).length;
  log(`Enrichment done: ${found}/${leads.length} have phone`);
  return leads;
}

async function enrichOne(l, log) {
  // ① Instagram post captions — free, already in profile data
  const captions = (l._posts || []).map(p => p.caption || p.text || '').join(' ');
  const capPhone = extractPhoneFromText(captions);
  if (capPhone) { l.phone = capPhone; log(`📞 ${l.name}: Instagram caption`); return; }

  // ② All link-in-bio services (Linktree, Beacons, Taplink, Bio.fm, Campsite …)
  const bioUrls = extractAllLinkInBio(l.website, l.bio);
  for (const url of bioUrls) {
    const phone = await scrapeLinkInBio(url);
    if (phone) { l.phone = phone; log(`📞 ${l.name}: ${shortUrl(url)}`); return; }
  }

  // ③ Website deeper scrape — raw HTML + tel: links, 6 page variants in parallel
  if (l.website && !isLinkInBioUrl(l.website)) {
    const result = await fetchContactDeep(l.website);
    if (result?.phone) {
      l.phone = result.phone;
      l.email = l.email || result.email || null;
      log(`📞 ${l.name}: website ${result.page}`);
      return;
    }
    if (result?.email && !l.email) l.email = result.email;
  }

  // ④ Brave Search: "[name] yoga [city] WhatsApp" (set BRAVE_API_KEY in Vercel env)
  if (process.env.BRAVE_API_KEY) {
    const phone = await braveSearchPhone(l.name, l.insta, l.location);
    if (phone) { l.phone = phone; log(`📞 ${l.name}: Brave Search`); return; }
  }
}

// ─── CLAUDE ENRICHMENT ───────────────────────────────────────────────────────
async function claudeEnrich(leads, city, log) {
  if (!leads.length) return leads;
  log(`Claude enriching ${leads.length} leads`);
  try {
    const prompt =
`Extract for each lead: firstname (host personal first name only, not business name), retreat (most specific upcoming or recent retreat/workshop/YTT name — past events qualify; null if truly none), variant ("a" upcoming / "b" past / null unclear), email (if found in text), phone (international format if found; null otherwise — never invent).

Leads for ${city}:
${leads.map((l, i) =>
  `[${i}] Name: ${l.name} | bio: ${(l.bio||'').slice(0,150)} | phone: ${l.phone||''} | email: ${l.email||''}`
).join('\n')}

Return ONLY a JSON array of ${leads.length} objects:
[{"firstname":"...","retreat":"...","variant":"a","email":null,"phone":null},...]`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data  = await r.json();
    const raw   = data.content?.[0]?.text || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('no json from Claude');

    const enriched = JSON.parse(match[0]);
    return leads.map((l, i) => {
      const e = enriched[i] || {};
      return {
        ...l,
        firstname: e.firstname || firstWord(l.name),
        retreat:   e.retreat   || null,
        variant:   e.variant   || 'a',
        email:     l.email     || e.email  || null,
        phone:     l.phone     || e.phone  || null,
      };
    });
  } catch (e) {
    log(`Claude enrich error: ${e.message}`);
    return leads.map(l => ({ ...l, firstname: firstWord(l.name), variant: 'a' }));
  }
}

// ─── B3 WA LINK ───────────────────────────────────────────────────────────────
function buildWALink(lead) {
  if (!lead.phone) return null;
  const phone = lead.phone.replace(/[\s\-()]/g,'').replace(/^\+/,'').replace(/^00/,'');
  const name  = lead.firstname || firstWord(lead.name);
  const hook  = lead.retreat
    ? (lead.variant === 'b'
        ? `You held the ${lead.retreat}, is that right?`
        : `You are hosting the ${lead.retreat}, is that right?`)
    : `You are organizing yoga retreats, is that right?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Dear ${name}, Kevin here from Bali.\n\n${hook}`)}`;
}

// ─── B4 NOTION WRITE ─────────────────────────────────────────────────────────
async function existsInCRM(instaHandle, name) {
  // Check by Instagram handle first (most reliable), then by name
  const filters = [];
  if (instaHandle) filters.push({ property: 'Insta', rich_text: { equals: instaHandle } });
  if (name)        filters.push({ property: 'Name',  title:     { equals: name } });
  if (!filters.length) return false;
  const filter = filters.length === 1 ? filters[0] : { or: filters };
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({ filter, page_size: 1 }),
    });
    const d = await r.json();
    return (d.results || []).length > 0;
  } catch { return false; }
}

async function writeToNotion(leads, city, blocklist, log) {
  const today    = new Date().toISOString().slice(0, 10);
  const mapsLink = `https://www.google.com/maps/search/yoga+retreat+${encodeURIComponent(city)}`;
  const results  = [];

  for (const lead of leads) {
    // 1. Check text blocklist (fast, no API call)
    const nameLC = (lead.name || '').toLowerCase();
    const inBlocked = [...blocklist].some(e => e && (nameLC === e || nameLC.startsWith(e + ' ') || nameLC.endsWith(' ' + e)));
    if (inBlocked) { results.push({ ...lead, status: 'skipped', reason: 'Duplicate (blocklist)' }); continue; }

    // 2. Check actual Notion CRM for existing record
    const alreadyIn = await existsInCRM(lead.insta, lead.name);
    if (alreadyIn) { log(`Skipping "${lead.name}" — already in CRM`); results.push({ ...lead, status: 'skipped', reason: 'Already in CRM' }); continue; }

    try {
      const nr = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: CRM_DB_ID },
          properties: {
            'Name':           { title:        [{ text: { content: lead.name || '' } }] },
            'Whatsapp':       { rich_text:    [{ text: { content: lead.phone || '' } }] },
            'Email':          { email:        lead.email || null },
            'Website':        { rich_text:    [{ text: { content: lead.website || '' } }] },
            'Location':       { rich_text:    [{ text: { content: lead.location || mapsLink } }] },
            'Insta':          { rich_text:    [{ text: { content: lead.insta || '' } }] },
            'Contact':        { rich_text:    [{ text: { content: 'Kevin' } }] },
            'Reached out on': { multi_select: [] },
            'Engaged first':  { date:         { start: today } },
          },
        }),
      });
      if (!nr.ok) {
        const body = await nr.json().catch(() => ({}));
        log(`Notion write failed for "${lead.name}": ${body.message || nr.status}`);
        results.push({ ...lead, status: 'error', reason: body.message || `HTTP ${nr.status}` });
      } else {
        results.push({ ...lead, status: 'added' });
      }
    } catch (e) {
      log(`Notion write exception for "${lead.name}": ${e.message}`);
      results.push({ ...lead, status: 'error', reason: e.message });
    }
  }
  return results;
}

// ─── APIFY ────────────────────────────────────────────────────────────────────
async function apifyRun(actorSlug, input) {
  const url = `https://api.apify.com/v2/acts/${actorSlug}/run-sync-get-dataset-items`
    + `?token=${process.env.APIFY_TOKEN}&timeout=90&memory=1024`;
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Apify ${actorSlug} ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VER,
  };
}
function firstWord(s) { return (s || '').split(/[\s,]+/)[0] || s || ''; }
function mergeDedupe(a, b) {
  const seen = new Set(a.map(l => l.name.toLowerCase()));
  return [...a, ...b.filter(l => !seen.has(l.name.toLowerCase()))];
}

// ─── RETRO ENRICH (was api/retro-enrich.js) ──────────────────────────────────

async function handleRetroEnrich(req, res) {
  const dry  = req.body?.dry === true || req.query?.dry === '1';
  const _log = [];
  const log  = (msg) => { console.log('[retro-enrich]', msg); _log.push(msg); };

  try {
    const today = new Date().toISOString().slice(0, 10);
    log(`Fetching today's leads (${today}) from Notion CRM…`);
    const leads   = await fetchTodaysLeads(today);
    const hadPhone = leads.filter(l => l.phone).length;
    log(`Found ${leads.length} leads — ${hadPhone} already have a phone, enriching ${leads.length - hadPhone}`);

    const rows = [];
    for (const lead of leads) {
      if (lead.phone) {
        rows.push({ name: lead.name, insta: lead.insta, phone: lead.phone, source: 'already had', updated: false });
        continue;
      }
      const result = await retroEnrichOne(lead, log);
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
    return res.json({ today, total: leads.length, hadPhone, found, updated, dry, rows, _log });
  } catch (err) {
    console.error('retro-enrich:', err);
    return res.status(500).json({ error: err.message, _log });
  }
}

async function fetchTodaysLeads(today) {
  const leads = [];
  let cursor;
  do {
    const body = { filter: { property: 'Engaged first', date: { equals: today } }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB_ID}/query`, { method: 'POST', headers: notionHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (d.object === 'error') throw new Error(`Notion: ${d.message}`);
    for (const page of d.results || []) {
      const p = page.properties;
      leads.push({
        pageId:  page.id,
        name:    p['Name']?.title?.[0]?.plain_text || '',
        insta:   p['Insta']?.rich_text?.[0]?.plain_text || null,
        website: p['Website']?.rich_text?.[0]?.plain_text || null,
        phone:   p['Whatsapp']?.rich_text?.[0]?.plain_text || null,
        email:   p['Email']?.email || null,
        bio: '', _posts: [],
        location: p['Location']?.rich_text?.[0]?.plain_text || null,
      });
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

async function retroEnrichOne(l, log) {
  const captions = (l._posts || []).map(p => p.caption || p.text || '').join(' ');
  const capPhone = extractPhoneFromText(captions);
  if (capPhone) return { phone: capPhone, source: 'Instagram caption' };

  for (const url of extractAllLinkInBio(l.website, l.bio)) {
    const phone = await scrapeLinkInBio(url);
    if (phone) return { phone, source: shortUrl(url) };
  }

  if (l.website && !isLinkInBioUrl(l.website)) {
    const result = await fetchContactDeep(l.website);
    if (result?.phone) return { phone: result.phone, source: `website ${result.page}` };
  }

  if (process.env.BRAVE_API_KEY) {
    const phone = await braveSearchPhone(l.name, l.insta, l.location);
    if (phone) return { phone, source: 'Brave Search' };
  }

  return null;
}
