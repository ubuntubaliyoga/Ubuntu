// api/migrate-crm.js — ONE-TIME migration from 4 old CRM databases to the unified CRM_DB
// GET  /api/migrate-crm          → dry run (safe, read-only preview)
// POST /api/migrate-crm          → run migration
// Refuses to run if new DB already has data (safety guard).

const NOTION_API = 'https://api.notion.com/v1';

const OLD = {
  email:     '8e5622d3e57482ba950081ac7695672e',
  whatsapp:  '320622d3e5748066b6dfcea95816fad2',
  shala:     '320622d3e57480608324f0eb4d3b8a2c',
  converted: '325622d3e57481bbbaaedeb47e377f2c',
};

const CRM_DB = '34a622d3e57481738b3ce70824a6adf7';

const hdrs = {
  Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type':   'application/json',
};

function get(props, name, type) {
  const p = props[name];
  if (!p) return null;
  if (type === 'title')        return p.title?.map(t => t.plain_text).join('') || null;
  if (type === 'rich_text')    return p.rich_text?.map(t => t.plain_text).join('') || null;
  if (type === 'email')        return p.email || null;
  if (type === 'select')       return p.select?.name || null;
  if (type === 'multi_select') return p.multi_select?.map(s => s.name) || [];
  if (type === 'date')         return p.date?.start || null;
  return null;
}

// Try to parse free-text dates from old WhatsApp/Shala "Engaged first" field
function tryDate(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

async function readAll(dbId) {
  const out = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST', headers: hdrs, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Read ${dbId}: ${r.status}`);
    const d = await r.json();
    out.push(...d.results);
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return out;
}

function transform(page, source) {
  const p = page.properties;
  const sourceLabel = { email: 'Email', whatsapp: 'WhatsApp', shala: 'Shala', converted: null }[source];
  const isEmail     = source === 'email';
  const isWhatsapp  = source === 'whatsapp';
  const isConverted = source === 'converted';

  return {
    source:       sourceLabel,
    converted:    isConverted,
    name:         get(p, 'Name', 'title')                         || '(no name)',
    company:      get(p, 'Company', 'rich_text')                  || '',
    email:        isEmail ? get(p, 'Email', 'email') : get(p, 'Mail', 'rich_text') || '',
    location:     get(p, 'Location', 'rich_text')                 || '',
    insta:        get(p, 'Insta', 'rich_text')                    || '',
    website:      get(p, 'Website', 'rich_text')                  || '',
    linkedin:     isEmail ? get(p, 'Linkydinky', 'rich_text') : '',
    whatsapp:     isWhatsapp ? get(p, 'Whatsapp 1', 'rich_text') : get(p, 'Whatsapp', 'rich_text') || '',
    whatsapp2:    get(p, 'Whatsapp 2', 'rich_text')              || '',
    notes:        get(p, 'Notes', 'rich_text')                   || '',
    contact:      isConverted ? get(p, "Who's in contact", 'rich_text') || '' : '',
    status:       isEmail    ? get(p, 'Instagram',   'select')
                : isWhatsapp ? get(p, 'Multi-select', 'select')
                :              get(p, 'Status',       'select'),
    suitability:  get(p, 'Suitability', 'select'),
    reachedOutOn: isEmail ? get(p, 'Reached out on', 'multi_select')
                          : (isWhatsapp || source === 'shala') ? ['WhatsApp'] : [],
    engagedFirst: isEmail ? get(p, 'Engaged first', 'date')
                          : tryDate(get(p, 'Engaged first', 'rich_text')),
    engagedLast:  isEmail ? get(p, 'Engaged last', 'date') : null,
    engageNext:   get(p, 'Engage Next', 'date'),
    salesCall:    get(p, isEmail ? 'Sales Call Booked Date' : 'Sales Call/Visit Booked Date', 'date'),
  };
}

const rt = s => ({ rich_text: [{ text: { content: s || '' } }] });
const dt = s => s ? { date: { start: s } } : { date: null };

async function createPage(lead) {
  const props = {
    'Name':                         { title: [{ text: { content: lead.name } }] },
    'Company':                      rt(lead.company),
    'Email':                        { email: lead.email || null },
    'Location':                     rt(lead.location),
    'Insta':                        rt(lead.insta),
    'Website':                      rt(lead.website),
    'LinkedIn':                     rt(lead.linkedin),
    'Whatsapp':                     rt(lead.whatsapp),
    'Whatsapp 2':                   rt(lead.whatsapp2),
    'Notes':                        rt(lead.notes),
    'Contact':                      rt(lead.contact),
    'Converted':                    { checkbox: lead.converted },
    'Engage Next':                  dt(lead.engageNext),
    'Engaged first':                dt(lead.engagedFirst),
    'Engaged last':                 dt(lead.engagedLast),
    'Sales Call/Visit Booked Date': dt(lead.salesCall),
    'Reached out on': { multi_select: (lead.reachedOutOn || []).map(v => ({ name: v })) },
    ...(lead.source      && { 'Source':      { select: { name: lead.source } } }),
    ...(lead.status      && { 'Status':      { select: { name: lead.status } } }),
    ...(lead.suitability && { 'Suitability': { select: { name: lead.suitability } } }),
  };
  const r = await fetch(`${NOTION_API}/pages`, {
    method: 'POST', headers: hdrs,
    body: JSON.stringify({ parent: { database_id: CRM_DB }, properties: props }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t}`); }
  return (await r.json()).id;
}

export default async function handler(req, res) {
  const dryRun = req.method === 'GET' || req.query?.dry_run === 'true';
  if (!process.env.NOTION_TOKEN) return res.status(500).json({ error: 'NOTION_TOKEN not set' });
  if (CRM_DB === 'REPLACE_WITH_NEW_DB_ID') return res.status(400).json({ error: 'Replace CRM_DB placeholder in migrate-crm.js first' });

  try {
    const force = req.query?.force === 'true';

    if (!dryRun) {
      const check = await fetch(`${NOTION_API}/databases/${CRM_DB}/query`, {
        method: 'POST', headers: hdrs, body: JSON.stringify({ page_size: 1 }),
      });
      const existing = check.ok ? await check.json() : null;
      if (existing?.results?.length > 0) {
        if (!force) {
          return res.status(409).json({ error: 'New CRM_DB already has data. Use ?force=true to clear and re-migrate.' });
        }
        // Clear all existing pages in parallel
        console.log('[migrate-crm] force=true — clearing existing data…');
        const allExisting = await readAll(CRM_DB);
        await Promise.all(allExisting.map(page =>
          fetch(`${NOTION_API}/pages/${page.id}`, {
            method: 'PATCH', headers: hdrs, body: JSON.stringify({ in_trash: true }),
          })
        ));
        console.log(`[migrate-crm] cleared ${allExisting.length} existing pages`);
      }
    }

    const reads = await Promise.all(
      Object.entries(OLD).map(([src, id]) =>
        readAll(id).then(pages => pages.map(p => transform(p, src)))
      )
    );
    const all = reads.flat();
    console.log(`[migrate-crm] ${dryRun ? 'DRY RUN' : 'MIGRATING'} — ${all.length} leads`);

    if (dryRun) {
      return res.status(200).json({
        dry_run: true,
        total:   all.length,
        by_source: Object.fromEntries(
          ['Email','WhatsApp','Shala',null].map(src => [
            src || 'converted',
            all.filter(l => l.source === src).length,
          ])
        ),
        sample: all.slice(0, 5).map(l => ({
          name: l.name, source: l.source, converted: l.converted,
          email: l.email, engagedFirst: l.engagedFirst,
        })),
      });
    }

    // Create in parallel batches of 20 to stay well within Vercel timeout
    let created = 0, failed = 0;
    const errors = [];
    const BATCH = 20;
    for (let i = 0; i < all.length; i += BATCH) {
      await Promise.all(all.slice(i, i + BATCH).map(async lead => {
        try { await createPage(lead); created++; }
        catch (e) { failed++; errors.push({ name: lead.name, error: e.message }); }
      }));
    }

    console.log(`[migrate-crm] done — created: ${created}, failed: ${failed}`);
    return res.status(200).json({ success: true, total: all.length, created, failed, errors });

  } catch (err) {
    console.error('[migrate-crm]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
