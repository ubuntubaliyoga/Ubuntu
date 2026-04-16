// api/crm.js
const LEAD_DB = '8e5622d3e57482ba950081ac7695672e';
const CONV_DB = '325622d3e57481bbbaaedeb47e377f2c';
// api/crm.js
// Handles read/update for Lead Pipeline and Converted Leads databases

const headers = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function getProp(props, name, type) {
  const p = props[name];
  if (!p) return null;
  if (type === 'title')        return p.title?.map(t => t.plain_text).join('') || null;
  if (type === 'text')         return p.rich_text?.map(t => t.plain_text).join('') || null;
  if (type === 'email')        return p.email || null;
  if (type === 'select')       return p.select?.name || null;
  if (type === 'multi_select') return p.multi_select?.map(s => s.name) || [];
  if (type === 'date')         return p.date?.start || null;
  if (type === 'url')          return p.url || null;
  if (type === 'phone')        return p.phone_number || null;
  return null;
}

function mapLead(page) {
  const p = page.properties;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           'leads',
    name:         getProp(p, 'Name',                  'title'),
    company:      getProp(p, 'Company',               'text'),
    email:        getProp(p, 'Email',                 'email'),
    location:     getProp(p, 'Location',              'text'),
    insta:        getProp(p, 'Insta',                 'text'),
    website:      getProp(p, 'Website',               'text'),
    linkedin:     getProp(p, 'Linkydinky',            'text'),
    notes:        getProp(p, 'Notes',                 'text'),
    status:       getProp(p, 'Instagram',             'select'),
    suitability:  getProp(p, 'Suitability',           'select'),
    reachedOutOn: getProp(p, 'Reached out on',        'multi_select'),
    engagedFirst: getProp(p, 'Engaged first',         'date'),
    engagedLast:  getProp(p, 'Engaged last',          'date'),
    engageNext:   getProp(p, 'Engage Next',           'date'),
    salesCall:    getProp(p, 'Sales Call Booked Date','date'),
  };
}

function mapConverted(page) {
  const p = page.properties;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           'converted',
    name:         getProp(p, 'Name',                         'title'),
    company:      getProp(p, 'Company',                      'text'),
    email:        getProp(p, 'Mail',                         'text'),
    location:     getProp(p, 'Location',                     'text'),
    insta:        getProp(p, 'Insta',                        'text'),
    website:      getProp(p, 'Website',                      'text'),
    whatsapp:     getProp(p, 'Whatsapp',                     'text'),
    notes:        getProp(p, 'Notes',                        'text'),
    contact:      getProp(p, "Who's in contact",             'text'),
    status:       getProp(p, 'Status',                       'multi_select'),
    suitability:  getProp(p, 'Suitability',                  'select'),
    engageNext:   getProp(p, 'Engage Next',                  'date'),
    salesCall:    getProp(p, 'Sales Call/Visit Booked Date', 'date'),
  };
}

async function queryDB(dbId, mapper) {
  const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100,
    }),
  });
  if (!resp.ok) throw new Error(`DB query failed: ${await resp.text()}`);
  const data = await resp.json();
  return data.results.map(mapper);
}

async function updatePage(pageId, properties) {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties }),
  });
  if (!resp.ok) throw new Error(`Update failed: ${await resp.text()}`);
  return await resp.json();
}

async function createLead(body) {
  const resp = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: LEAD_DB },
      properties: {
        'Name':     { title:     [{ text: { content: body.name || '' } }] },
        'Company':  { rich_text: [{ text: { content: body.company || '' } }] },
        'Email':    { email: body.email || null },
        'Location': { rich_text: [{ text: { content: body.location || '' } }] },
        'Insta':    { rich_text: [{ text: { content: body.insta || '' } }] },
        'Notes':    { rich_text: [{ text: { content: body.notes || '' } }] },
        ...(body.status && { 'Instagram': { select: { name: body.status } } }),
      },
    }),
  });
  if (!resp.ok) throw new Error(`Create failed: ${await resp.text()}`);
  return await resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    // ── LOAD ALL ──────────────────────────────────────────────────────────────
    if (action === 'load') {
      const [leads, converted] = await Promise.all([
        queryDB(LEAD_DB, mapLead),
        queryDB(CONV_DB, mapConverted),
      ]);
      return res.status(200).json({ leads, converted });
    }

    // ── UPDATE STATUS / NOTES ─────────────────────────────────────────────────
    if (action === 'update') {
      const { pageId, db, status, notes, engageNext } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });

      const props = {};
      if (notes !== undefined) {
        props['Notes'] = { rich_text: [{ text: { content: notes } }] };
      }
      if (engageNext !== undefined) {
        props['Engage Next'] = engageNext ? { date: { start: engageNext } } : { date: null };
      }
      if (status !== undefined) {
        if (db === 'leads') {
          props['Instagram'] = { select: { name: status } };
        } else {
          props['Status'] = { multi_select: status.map(s => ({ name: s })) };
        }
      }

      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    // ── CREATE LEAD ───────────────────────────────────────────────────────────
    if (action === 'create') {
      const page = await createLead(req.body);
      return res.status(200).json({ success: true, pageId: page.id });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[crm]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

