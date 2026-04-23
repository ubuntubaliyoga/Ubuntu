// api/leadgen-agent.js
// Ubuntu Bali — Lead Research & Notion Sync
// B1: blocklist → B2: 3-search discovery (Google) + Instagram enrich + Maps fallback
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

  try {
    // B1
    const blocklist = await fetchBlocklist();

    // B2
    let leads = await b2Research(city);

    // Google Maps supplement if < 10
    if (leads.length < 10) {
      const extra = await googleMapsLeads(city, 13 - leads.length);
      leads = mergeDedupe(leads, extra);
    }

    // Blocklist filter + cap
    leads = filterBlocklist(leads, blocklist).slice(0, 10);

    // Enrich contacts via websites
    leads = await enrichContacts(leads);

    // Claude: first names, retreat names, variant
    leads = await claudeEnrich(leads, city);

    // B3: WA links
    leads = leads.map(l => ({ ...l, waLink: buildWALink(l) }));

    // B4: Notion
    const results = await writeToNotion(leads, city, blocklist);

    // Append written names to blocklist
    const newNames = results.filter(r => r.status === 'added').map(r => r.name);
    if (newNames.length) await appendBlocklist(newNames);

    res.json({ leads: results, city, found: results.length });
  } catch (err) {
    console.error('leadgen-agent:', err);
    res.status(500).json({ error: err.message });
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

// Match on candidate's OWN name only — shared surname / venue contact is NOT a match
function filterBlocklist(leads, blocklist) {
  return leads.filter(l => {
    const n = (l.name || '').toLowerCase();
    for (const e of blocklist) {
      if (e && (n === e || n.startsWith(e + ' ') || n.endsWith(' ' + e))) return false;
    }
    return true;
  });
}

// ─── B2 RESEARCH ─────────────────────────────────────────────────────────────
async function b2Research(city) {
  // Search 1: discover top local yoga/wellness platforms for this city
  const platResults = await googleSearch(
    `top yoga wellness retreat event listing platforms ${city} 2025`
  );
  const platforms = extractPlatformDomains(platResults, city);

  // Build site: filter from discovered platforms (cap at 4)
  const siteFilter = platforms.length
    ? platforms.slice(0, 4).map(d => `site:${d}`).join(' OR ')
    : '';

  // Search 2: facilitators on local platforms
  const [s2, s3] = await Promise.all([
    googleSearch(`yoga OR retreat OR wellness facilitator "${city}" 2025 2026 ${siteFilter}`.trim()),
    googleSearch(`yoga studio "${city}" retreat OR workshop OR program contact ${siteFilter}`.trim()),
  ]);

  // Extract up to 12 candidates from S2+S3 combined
  const candidates = extractCandidates([...s2, ...s3], city).slice(0, 12);

  // Fetch contact pages for candidates (up to 4 fetches as per prompt)
  await fetchCandidateContacts(candidates);

  // Instagram profile scrape for any handles found
  const handles = candidates.map(c => c.insta).filter(Boolean).map(h => h.replace(/^@/, ''));
  if (handles.length) {
    const profiles = await instagramProfileScrape(handles);
    profiles.forEach(p => {
      const c = candidates.find(c => c.insta === `@${p.username}`);
      if (c) {
        c.phone = c.phone || null;
        c.email = c.email || null;
        c.bio   = c.bio   || p.biography || '';
        c.website = c.website || p.externalUrl || null;
      }
    });
  }

  return candidates.filter(c => c.retreat || c.bio || c.website); // DROP: no event of any kind
}

// ─── GOOGLE SEARCH (Apify) ────────────────────────────────────────────────────
async function googleSearch(query) {
  try {
    const results = await apifyRun('apify~google-search-scraper', {
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      languageCode: 'en',
    });
    return Array.isArray(results) ? results : [];
  } catch { return []; }
}

function extractPlatformDomains(results, city) {
  const GENERIC = new Set(['google.com','facebook.com','instagram.com','linkedin.com','youtube.com','wikipedia.org','tripadvisor.com']);
  const domains = new Set();
  for (const r of results) {
    try {
      const host = new URL(r.url || r.link || '').hostname.replace(/^www\./, '');
      if (!GENERIC.has(host) && host.includes('.')) domains.add(host);
    } catch { /* skip invalid */ }
  }
  return [...domains].slice(0, 6);
}

function extractCandidates(results, city) {
  const seen = new Set();
  const out  = [];
  const EVENT_KW = ['retreat', 'workshop', 'immersion', 'ytt', 'training', 'program', 'course', 'yoga', 'wellness'];

  for (const r of results) {
    const url   = r.url || r.link || '';
    const title = r.title || '';
    const desc  = r.description || r.snippet || '';
    const text  = (title + ' ' + desc).toLowerCase();

    if (!url || seen.has(url)) continue;
    if (!EVENT_KW.some(k => text.includes(k))) continue;
    seen.add(url);

    const isInsta = url.includes('instagram.com/');
    const insta   = isInsta ? '@' + url.split('instagram.com/')[1]?.split('/')[0] : null;

    out.push({
      source:    'search',
      name:      title.split(' - ')[0].split(' | ')[0].trim() || title,
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

// ─── WEBSITE CONTACT FETCHING ────────────────────────────────────────────────
async function fetchCandidateContacts(candidates) {
  // Max 4 fetches as per prompt — prioritise those missing phone
  const toFetch = candidates
    .filter(c => c.website && !c.phone)
    .slice(0, 4);

  await Promise.allSettled(toFetch.map(async c => {
    const contact = await fetchContact(c.website);
    if (contact) {
      c.phone = contact.phone || c.phone;
      c.email = contact.email || c.email;
      c.bio   = (c.bio + ' ' + (contact.text || '')).slice(0, 400);
    }
  }));

  // Batched OR-search for still-missing phones (1 search)
  const stillMissing = candidates.filter(c => !c.phone).slice(0, 3);
  if (stillMissing.length >= 2) {
    const orQuery = stillMissing.map(c => `"${c.name}"`).join(' OR ') + ` contact phone`;
    const r = await googleSearch(orQuery);
    stillMissing.forEach(c => {
      const hit = r.find(x => (x.description || '').includes(c.name.split(' ')[0]));
      if (hit) {
        const phone = (hit.description || '').match(/\+?[\d][\d\s\-().]{8,16}[\d]/)?.[0];
        if (phone) c.phone = phone.trim();
      }
    });
  }
}

async function fetchContact(url) {
  try {
    // Try /events or /retreat page first, then /contact
    const targets = [url + '/events', url + '/retreat', url + '/contact', url];
    for (const target of targets.slice(0, 2)) {
      const r = await fetch(`https://r.jina.ai/${target}`, {
        headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
        signal: AbortSignal.timeout(7000),
      });
      const text = (await r.text()).slice(0, 800);
      const phone = text.match(/\+?[\d][\d\s\-().]{8,16}[\d]/)?.[0]?.trim() || null;
      const email = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0]       || null;
      if (phone || email) return { phone, email, text };
    }
    return null;
  } catch { return null; }
}

// ─── INSTAGRAM PROFILE SCRAPE ────────────────────────────────────────────────
async function instagramProfileScrape(usernames) {
  if (!usernames.length) return [];
  try {
    const items = await apifyRun('apify~instagram-profile-scraper', { usernames });
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

// ─── GOOGLE MAPS FALLBACK ────────────────────────────────────────────────────
async function googleMapsLeads(city, limit) {
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
        website:  i.website || null,
        insta:    null,
        phone:    i.phone   || null,
        email:    null,
        bio:      i.description || '',
        retreat:  null,
        firstname: null,
        variant:  null,
        location: i.url || null,
      }));
  } catch { return []; }
}

// ─── CONTACT ENRICHMENT ──────────────────────────────────────────────────────
async function enrichContacts(leads) {
  const toFetch = leads.filter(l => l.website && !l.phone && !l.email).slice(0, 3);
  await Promise.allSettled(toFetch.map(async l => {
    const c = await fetchContact(l.website);
    if (c) { l.phone = c.phone || l.phone; l.email = c.email || l.email; }
  }));
  return leads;
}

// ─── CLAUDE ENRICHMENT ───────────────────────────────────────────────────────
async function claudeEnrich(leads, city) {
  if (!leads.length) return leads;
  try {
    const prompt =
`Extract for each lead: firstname (host personal first name only), retreat (most specific upcoming or recent retreat/workshop/YTT name — past events qualify; null if truly none), variant ("a" upcoming / "b" past only / null unclear), email (if in text), phone (international format if in text; null if not found — never invent).

Leads for ${city}:
${leads.map((l, i) =>
  `[${i}] Name: ${l.name} | bio: ${(l.bio||'').slice(0,150)} | phone: ${l.phone||''} | email: ${l.email||''}`
).join('\n')}

Return ONLY a JSON array of ${leads.length} objects:
[{"firstname":"...","retreat":"...","variant":"a","email":null,"phone":null},...]`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
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
    if (!match) throw new Error('no json');

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
  } catch {
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
async function writeToNotion(leads, city, blocklist) {
  const today    = new Date().toISOString().slice(0, 10);
  const mapsLink = `https://www.google.com/maps/search/yoga+retreat+${encodeURIComponent(city)}`;
  const results  = [];

  for (const lead of leads) {
    // Re-check blocklist immediately before each write
    const nameLC = (lead.name || '').toLowerCase();
    let dup = false;
    for (const e of blocklist) {
      if (e && (nameLC === e || nameLC.startsWith(e + ' ') || nameLC.endsWith(' ' + e))) { dup = true; break; }
    }
    if (dup) { results.push({ ...lead, status: 'skipped', reason: `Duplicate: ${lead.name}` }); continue; }

    try {
      await fetch('https://api.notion.com/v1/pages', {
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
      results.push({ ...lead, status: 'added' });
    } catch (e) {
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
    throw new Error(`Apify ${actorSlug} ${r.status}: ${txt.slice(0, 120)}`);
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
