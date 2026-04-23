// api/leadgen-agent.js
// Ubuntu Bali — Lead Research & Notion Sync
// B1: blocklist → B2: 3-search (Jina/DDG, free) + Instagram (Apify) + Maps fallback (Apify)
// → B3: WA links → B4: Notion write

export const config = { maxDuration: 120 };

const BLOCKLIST_PAGE_ID = '333622d3-e574-8159-b0d7-d4998af4cf2c';
const CRM_DB_ID         = '34a622d3e57481738b3ce70824a6adf7';
const NOTION_VER        = '2022-06-28';

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
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

// ─── B2 RESEARCH (Jina + DuckDuckGo — free, no Apify credits) ────────────────
async function b2Research(city, log) {
  // Search 1: discover local yoga/wellness platforms
  log('S1: discovering local platforms');
  const s1 = await ddgSearch(`top yoga wellness retreat event listing platforms ${city} 2025`);
  log(`S1: ${s1.length} results`);
  const platforms = extractPlatformDomains(s1);
  log(`S1: platforms found: ${platforms.join(', ') || 'none'}`);

  const siteFilter = platforms.length
    ? platforms.slice(0, 4).map(d => `site:${d}`).join(' OR ')
    : '';

  // Searches 2+3 in parallel
  log('S2+S3: searching for facilitators');
  const [s2, s3] = await Promise.all([
    ddgSearch(`yoga OR retreat OR wellness facilitator "${city}" 2025 2026 ${siteFilter}`.trim()),
    ddgSearch(`yoga studio "${city}" retreat OR workshop OR program contact ${siteFilter}`.trim()),
  ]);
  log(`S2: ${s2.length} results, S3: ${s3.length} results`);

  const candidates = extractCandidates([...s2, ...s3], city).slice(0, 12);
  log(`Candidates extracted: ${candidates.length}`);

  // Fetch up to 4 contact pages
  await fetchCandidateContacts(candidates, log);

  // Instagram profile scrape for any @handles found
  const handles = candidates.map(c => c.insta).filter(Boolean).map(h => h.replace(/^@/, ''));
  if (handles.length) {
    log(`Instagram: scraping ${handles.length} profiles`);
    const profiles = await instagramProfileScrape(handles, log);
    log(`Instagram: got ${profiles.length} profiles back`);
    profiles.forEach(p => {
      const c = candidates.find(c => c.insta === `@${p.username}`);
      if (c) {
        c.bio     = c.bio     || p.biography    || '';
        c.website = c.website || p.externalUrl  || null;
      }
    });
  }

  // Keep only candidates that have some event signal
  return candidates.filter(c => c.bio || c.website);
}

// ─── DUCKDUCKGO SEARCH via Jina (free) ───────────────────────────────────────
async function ddgSearch(query) {
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const r = await fetch(`https://r.jina.ai/${ddgUrl}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(12000),
    });
    const text = await r.text();
    return parseDDGResults(text);
  } catch (e) {
    console.error('[ddgSearch]', e.message);
    return [];
  }
}

function parseDDGResults(text) {
  const results = [];
  const seen    = new Set();
  // Jina renders DDG as markdown — links appear as [title](url)
  const re = /\[([^\]]{5,120})\]\((https?:\/\/[^\)\s]{10,})\)/g;
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let m;
    const lineRe = /\[([^\]]{5,120})\]\((https?:\/\/[^\)\s]{10,})\)/g;
    while ((m = lineRe.exec(lines[i])) !== null) {
      const [, title, url] = m;
      if (seen.has(url)) continue;
      // Skip DDG-internal links
      if (url.includes('duckduckgo.com') || url.includes('duck.co')) continue;
      seen.add(url);
      // Grab next non-empty, non-link line as snippet
      const snippet = lines.slice(i + 1, i + 4)
        .find(l => l.trim() && !l.includes('](http')) || '';
      results.push({ title: title.trim(), url, description: snippet.trim() });
    }
  }
  return results;
}

function extractPlatformDomains(results) {
  const GENERIC = new Set([
    'google.com','facebook.com','instagram.com','linkedin.com',
    'youtube.com','wikipedia.org','tripadvisor.com','duckduckgo.com',
    'reddit.com','twitter.com','x.com','yelp.com',
  ]);
  const domains = new Set();
  for (const r of results) {
    try {
      const host = new URL(r.url || '').hostname.replace(/^www\./, '');
      if (!GENERIC.has(host) && host.includes('.')) domains.add(host);
    } catch { /* skip */ }
  }
  return [...domains].slice(0, 6);
}

function extractCandidates(results, city) {
  const seen     = new Set();
  const out      = [];
  const EVENT_KW = ['retreat','workshop','immersion','ytt','training','program','course','yoga','wellness','meditation'];

  for (const r of results) {
    const url   = r.url   || '';
    const title = r.title || '';
    const desc  = r.description || '';
    const text  = (title + ' ' + desc).toLowerCase();

    if (!url || seen.has(url)) continue;
    if (!EVENT_KW.some(k => text.includes(k))) continue;
    seen.add(url);

    const isInsta = url.includes('instagram.com/');
    const insta   = isInsta
      ? '@' + (url.split('instagram.com/')[1] || '').split(/[/?]/)[0]
      : null;

    out.push({
      source:    'search',
      name:      title.split(/[\-\|–]/)[0].trim() || title,
      website:   isInsta ? null : url,
      insta,
      bio:       desc,
      phone:     null,
      email:     null,
      retreat:   null,
      firstname: null,
      variant:   null,
    });
  }
  return out;
}

// ─── WEBSITE CONTACT FETCHING ─────────────────────────────────────────────────
async function fetchCandidateContacts(candidates, log) {
  const toFetch = candidates.filter(c => c.website && !c.phone).slice(0, 4);
  log(`Fetching ${toFetch.length} websites for contact info`);

  await Promise.allSettled(toFetch.map(async c => {
    const contact = await fetchContact(c.website);
    if (contact) {
      c.phone = contact.phone || c.phone;
      c.email = contact.email || c.email;
      c.bio   = (c.bio + ' ' + (contact.text || '')).slice(0, 400);
    }
  }));

  // Batched OR-search for still-missing phones
  const stillMissing = candidates.filter(c => !c.phone).slice(0, 3);
  if (stillMissing.length >= 2) {
    const orQuery = stillMissing.map(c => `"${c.name}"`).join(' OR ') + ` contact phone ${candidates[0]?.bio?.slice(0,20) || ''}`;
    const r = await ddgSearch(orQuery);
    stillMissing.forEach(c => {
      const hit = r.find(x => (x.description || '').toLowerCase().includes(c.name.split(' ')[0].toLowerCase()));
      if (hit) {
        const phone = (hit.description || '').match(/\+?[\d][\d\s\-().]{8,16}[\d]/)?.[0];
        if (phone) c.phone = phone.trim();
      }
    });
  }
}

async function fetchContact(url) {
  try {
    for (const suffix of ['/events', '/contact']) {
      const r = await fetch(`https://r.jina.ai/${url}${suffix}`, {
        headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
        signal: AbortSignal.timeout(7000),
      });
      const text  = (await r.text()).slice(0, 800);
      const phone = text.match(/\+?[\d][\d\s\-().]{8,16}[\d]/)?.[0]?.trim() || null;
      const email = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0]       || null;
      if (phone || email) return { phone, email, text };
    }
    return null;
  } catch { return null; }
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
  try {
    const items = await apifyRun('apify~google-maps-scraper', {
      searchStringsArray: [`yoga retreat ${city}`, `yoga studio ${city}`],
      maxCrawledPlacesPerSearch: Math.ceil(limit / 2) + 2,
      language: 'en',
    });
    return (Array.isArray(items) ? items : [])
      .filter(i => i.title)
      .map(i => ({
        source:   'google_maps',
        name:     i.title,
        website:  i.website  || null,
        insta:    null,
        phone:    i.phone    || null,
        email:    null,
        bio:      i.description || '',
        retreat:  null,
        firstname: null,
        variant:  null,
        location: i.url || null,
      }));
  } catch (e) {
    log(`Maps error: ${e.message}`);
    return [];
  }
}

// ─── CONTACT ENRICHMENT ──────────────────────────────────────────────────────
async function enrichContacts(leads, log) {
  const toFetch = leads.filter(l => l.website && !l.phone && !l.email).slice(0, 3);
  if (toFetch.length) log(`Enriching ${toFetch.length} websites`);
  await Promise.allSettled(toFetch.map(async l => {
    const c = await fetchContact(l.website);
    if (c) { l.phone = c.phone || l.phone; l.email = c.email || l.email; }
  }));
  return leads;
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
async function writeToNotion(leads, city, blocklist, log) {
  const today    = new Date().toISOString().slice(0, 10);
  const mapsLink = `https://www.google.com/maps/search/yoga+retreat+${encodeURIComponent(city)}`;
  const results  = [];

  for (const lead of leads) {
    const nameLC = (lead.name || '').toLowerCase();
    let dup = false;
    for (const e of blocklist) {
      if (e && (nameLC === e || nameLC.startsWith(e + ' ') || nameLC.endsWith(' ' + e))) { dup = true; break; }
    }
    if (dup) { results.push({ ...lead, status: 'skipped', reason: `Duplicate: ${lead.name}` }); continue; }

    try {
      const nr = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: CRM_DB_ID },
          properties: {
            'Name':          { title:     [{ text: { content: lead.name || '' } }] },
            'Whatsapp 1':    { rich_text: [{ text: { content: lead.waLink || 'No number found' } }] },
            'Mail':          { rich_text: [{ text: { content: lead.email || '' } }] },
            'Website':       { url: lead.website || null },
            'Location':      { rich_text: [{ text: { content: lead.location || mapsLink } }] },
            'Insta':         { rich_text: [{ text: { content: lead.insta || '' } }] },
            'Engaged first': { rich_text: [{ text: { content: today } }] },
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
