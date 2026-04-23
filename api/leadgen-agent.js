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

// ─── B2 RESEARCH (Jina web search — free, no Apify credits) ──────────────────
async function b2Research(city, log) {
  // Three parallel searches targeting different lead sources
  log('S1+S2+S3: searching for yoga/retreat leads');
  const [s1, s2, s3] = await Promise.all([
    ddgSearch(`site:instagram.com yoga retreat teacher "${city}"`),
    ddgSearch(`yoga retreat workshop facilitator "${city}" 2025 contact`),
    ddgSearch(`yoga teacher training retreat "${city}" 2025 2026`),
  ]);
  log(`S1: ${s1.length} results, S2: ${s2.length} results, S3: ${s3.length} results`);

  const candidates = extractCandidates([...s1, ...s2, ...s3], city).slice(0, 14);
  log(`Candidates extracted: ${candidates.length}`);

  // Fetch contact pages for non-Instagram candidates
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
        c.bio     = c.bio     || p.biography   || '';
        c.website = c.website || p.externalUrl || null;
        c.phone   = c.phone   || p.businessPhoneNumber || null;
      }
    });
  }

  return candidates.filter(c => c.bio || c.website || c.insta);
}

// ─── WEB SEARCH via Jina (free) ──────────────────────────────────────────────
// Try Bing first — Google often returns a consent page that only has nav links.
async function ddgSearch(query) {
  const engines = [
    { url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`,        skip: 'microsoft.com' },
    { url: `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`,  skip: 'google.com' },
  ];
  for (const { url, skip } of engines) {
    try {
      const r = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: 'text/plain',
          'X-With-Links-Summary': 'true',   // appends numbered link list
          // no X-Return-Format → keeps markdown so [title](url) links survive
        },
        signal: AbortSignal.timeout(15000),
      });
      const text    = await r.text();
      const results = parseDDGResults(text, skip);
      if (results.length) return results;
    } catch (e) {
      console.error('[search]', e.message);
    }
  }
  return [];
}

function parseDDGResults(text, skipDomain) {
  const results = [];
  const seen    = new Set();
  const lines   = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineRe = /\[([^\]]{5,120})\]\((https?:\/\/[^\)\s]{10,})\)/g;
    let m;
    while ((m = lineRe.exec(lines[i])) !== null) {
      const [, title, url] = m;
      if (seen.has(url)) continue;
      // Skip search engine's own links (nav, consent pages, etc.)
      if (skipDomain && url.includes(skipDomain)) continue;
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
  const queries = [`yoga retreat ${city}`, `yoga studio ${city}`];
  const max     = Math.ceil(limit / 2) + 2;
  // Each actor uses its own input schema
  const attempts = [
    { slug: 'apify~google-maps-scraper',      input: { searchStringsArray: queries, maxCrawledPlacesPerSearch: max, language: 'en' } },
    { slug: 'compass~crawler-google-places',   input: { searchStrings: queries,      maxResultsPerQuery: max, language: 'en' } },
    { slug: 'apify~google-places-scraper',     input: { queries,                     maxResults: max } },
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
            'Name':           { title:        [{ text: { content: lead.name || '' } }] },
            'Whatsapp':       { rich_text:    [{ text: { content: lead.waLink || '' } }] },
            'Email':          { email:        lead.email || null },
            'Website':        { rich_text:    [{ text: { content: lead.website || '' } }] },
            'Location':       { rich_text:    [{ text: { content: lead.location || mapsLink } }] },
            'Insta':          { rich_text:    [{ text: { content: lead.insta || '' } }] },
            'Contact':        { rich_text:    [{ text: { content: 'Kevin' } }] },
            'Notes':          { rich_text:    [{ text: { content: (lead.bio || '').slice(0, 200) } }] },
            'Reached out on': { multi_select: [{ name: 'WhatsApp' }] },
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
