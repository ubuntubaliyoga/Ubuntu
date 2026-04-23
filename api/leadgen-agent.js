// api/leadgen-agent.js
// Ubuntu Bali — Lead Research & Notion Sync
// Flow: Instagram hashtags → profile scrape → Google Maps supplement →
//       Claude enrichment → blocklist dedup → Notion write

export const config = { maxDuration: 120 };

const BLOCKLIST_PAGE_ID = '333622d3-e574-8159-b0d7-d4998af4cf2c';
const LEADGEN_DB_ID     = '320622d3-e574-81e2-b672-000b38b5ed23';
const NOTION_VER        = '2022-06-28';

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { city } = req.body;
  if (!city?.trim()) return res.status(400).json({ error: 'city required' });

  try {
    // B1: blocklist (fail-safe — continue even if fetch fails)
    const blocklist = await fetchBlocklist();

    // B2: Instagram first, Google Maps as supplement
    let leads = await findInstagramLeads(city);
    if (leads.length < 10) {
      const needed  = 13 - leads.length; // buffer for dedup
      const mapLeads = await findGoogleMapsLeads(city, needed);
      leads = mergeDedupe(leads, mapLeads);
    }

    // Blocklist filter + cap
    leads = filterBlocklist(leads, blocklist).slice(0, 10);

    // Enrich: websites for contact info, then Claude for names/retreats
    leads = await enrichLeads(leads, city);

    // B3: WA links
    leads = leads.map(l => ({ ...l, waLink: buildWALink(l) }));

    // B4: Notion write (per-lead dedup re-check inside)
    const results = await writeLeadsToNotion(leads, city, blocklist);

    // Append written names to blocklist page (single call)
    const written = results.filter(r => r.status === 'added').map(r => r.name);
    if (written.length) await appendBlocklist(written);

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
    const data = await r.json();
    const text = (data.results || [])
      .flatMap(b => {
        const block = b.paragraph || b.bulleted_list_item || b.numbered_list_item || b.quote;
        return (block?.rich_text || []).map(t => t.plain_text);
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
        children: [{
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: names.join(', ') } }] },
        }],
      }),
    });
  } catch { /* non-critical */ }
}

// Match on the candidate's own name only — not venue or associated person
function filterBlocklist(leads, blocklist) {
  return leads.filter(lead => {
    const name = (lead.name || '').toLowerCase();
    for (const entry of blocklist) {
      if (entry && (name === entry || name.startsWith(entry + ' ') || name.endsWith(' ' + entry))) {
        return false;
      }
    }
    return true;
  });
}

// ─── B2 INSTAGRAM ─────────────────────────────────────────────────────────────
async function findInstagramLeads(city) {
  // Step 1: hashtag posts → unique usernames
  const usernames = await instagramHashtagUsernames(city);
  if (!usernames.length) return [];

  // Step 2: full profiles for those usernames
  return instagramProfileScrape(usernames);
}

async function instagramHashtagUsernames(city) {
  try {
    const slug = city.toLowerCase().replace(/[^a-z]/g, '');
    const hashtags = [
      `#${slug}yoga`,
      `#${slug}retreat`,
      `#${slug}wellness`,
      `#yoga${slug}`,
      `#retreat${slug}`,
    ];

    const posts = await apifyRun('apify~instagram-hashtag-scraper', {
      hashtags,
      resultsLimit: 40,
      proxy: { useApifyProxy: true },
    });

    const RETREAT_KW = ['retreat', 'workshop', 'immersion', 'ytt', 'training', 'program', 'course', 'teacher'];
    const seen = new Set();
    const out  = [];

    for (const p of (Array.isArray(posts) ? posts : [])) {
      const u = p.ownerUsername || p.username;
      if (!u || seen.has(u)) continue;
      const text = ((p.caption || '') + ' ' + (p.ownerBio || '')).toLowerCase();
      if (RETREAT_KW.some(k => text.includes(k))) { seen.add(u); out.push(u); }
    }

    // If caption-filter too strict, fall back to any username found
    if (out.length < 5) {
      for (const p of (Array.isArray(posts) ? posts : [])) {
        const u = p.ownerUsername || p.username;
        if (u && !seen.has(u)) { seen.add(u); out.push(u); }
      }
    }

    return out.slice(0, 20);
  } catch { return []; }
}

async function instagramProfileScrape(usernames) {
  try {
    const profiles = await apifyRun('apify~instagram-profile-scraper', {
      usernames: usernames.slice(0, 20),
    });

    const RETREAT_KW = ['retreat', 'workshop', 'immersion', 'ytt', 'training', 'program', 'course'];

    return (Array.isArray(profiles) ? profiles : [])
      .filter(p => {
        const bio = (p.biography || '').toLowerCase();
        return RETREAT_KW.some(k => bio.includes(k));
      })
      .map(p => ({
        source:   'instagram',
        name:     p.fullName || p.username,
        insta:    `@${p.username}`,
        website:  p.externalUrl || null,
        bio:      p.biography || '',
        phone:    null,
        email:    null,
        retreat:  null,
        firstname: null,
        variant:  null,
      }));
  } catch { return []; }
}

// ─── B2 GOOGLE MAPS ───────────────────────────────────────────────────────────
async function findGoogleMapsLeads(city, limit) {
  try {
    const items = await apifyRun('apify~google-maps-scraper', {
      searchStringsArray: [
        `yoga retreat ${city}`,
        `yoga studio ${city}`,
        `wellness retreat ${city}`,
      ],
      maxCrawledPlacesPerSearch: Math.ceil(limit / 2) + 2,
      language: 'en',
    });

    return (Array.isArray(items) ? items : [])
      .filter(i => i.title)
      .map(i => ({
        source:   'google_maps',
        name:     i.title,
        insta:    null,
        website:  i.website || null,
        phone:    i.phone   || null,
        email:    null,
        retreat:  null,
        firstname: null,
        variant:  null,
        bio:      i.description || '',
        location: i.url || null,
      }));
  } catch { return []; }
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────────
async function enrichLeads(leads, city) {
  // Fetch websites (capped at 5 to stay within timeout)
  const needFetch = leads.filter(l => l.website && !l.phone && !l.email).slice(0, 5);
  const fetched   = await Promise.allSettled(needFetch.map(l => fetchContact(l.website)));
  needFetch.forEach((lead, i) => {
    const v = fetched[i].value;
    if (v) { lead.phone = v.phone || lead.phone; lead.email = v.email || lead.email; }
  });

  // Claude batch enrichment for names + retreat identification
  return claudeEnrich(leads, city);
}

async function fetchContact(url) {
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(7000),
    });
    const text = (await r.text()).slice(0, 800);
    const phone = text.match(/\+?[\d][\d\s\-().]{8,16}[\d]/)?.[0]?.trim() || null;
    const email = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i)?.[0]    || null;
    return { phone, email };
  } catch { return null; }
}

async function claudeEnrich(leads, city) {
  try {
    const prompt = `Extract per lead: firstname (host's personal first name, not business), retreat (most specific upcoming or recent retreat/workshop/YTT name, null if none), variant ("a" upcoming event / "b" past only / null if unclear), email (if in bio/text), phone (international format if in bio/text).

Leads:
${leads.map((l, i) => `[${i}] ${l.name} | bio: ${(l.bio || '').slice(0, 150)} | phone: ${l.phone || ''} | email: ${l.email || ''}`).join('\n')}

Return ONLY a JSON array of ${leads.length} objects: [{"firstname":"...","retreat":"...","variant":"a","email":null,"phone":null},...]`;

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
        email:     l.email     || e.email   || null,
        phone:     l.phone     || e.phone   || null,
      };
    });
  } catch {
    return leads.map(l => ({ ...l, firstname: firstWord(l.name), variant: 'a' }));
  }
}

// ─── B3 WA LINK ───────────────────────────────────────────────────────────────
function buildWALink(lead) {
  if (!lead.phone) return null;
  const phone = lead.phone.replace(/[\s\-()]/g, '').replace(/^\+/, '').replace(/^00/, '');
  const name  = lead.firstname || firstWord(lead.name);
  const hook  = lead.retreat
    ? (lead.variant === 'b'
        ? `You held the ${lead.retreat}, is that right?`
        : `You are hosting the ${lead.retreat}, is that right?`)
    : `You are organizing retreats, is that right?`;
  const msg = `Dear ${name}, Kevin here from Bali.\n\n${hook}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ─── B4 NOTION WRITE ─────────────────────────────────────────────────────────
async function writeLeadsToNotion(leads, city, blocklist) {
  const today    = new Date().toISOString().slice(0, 10);
  const mapsLink = `https://www.google.com/maps/search/yoga+retreat+${encodeURIComponent(city)}`;
  const results  = [];

  for (const lead of leads) {
    // Re-check blocklist before each write
    const nameLC  = (lead.name || '').toLowerCase();
    let duplicate = false;
    for (const entry of blocklist) {
      if (entry && (nameLC === entry || nameLC.startsWith(entry + ' ') || nameLC.endsWith(' ' + entry))) {
        duplicate = true; break;
      }
    }
    if (duplicate) {
      results.push({ ...lead, status: 'skipped', reason: `Duplicate: ${lead.name}` });
      continue;
    }

    try {
      await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: LEADGEN_DB_ID },
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
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

function firstWord(str) {
  return (str || '').split(/[\s,]+/)[0] || str || '';
}

function mergeDedupe(a, b) {
  const seen = new Set(a.map(l => l.name.toLowerCase()));
  return [...a, ...b.filter(l => !seen.has(l.name.toLowerCase()))];
}
