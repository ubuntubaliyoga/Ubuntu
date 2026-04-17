// api/crm.js
const ALL_LEADS_DB = '2a0aa6a2a31e4ef0a3653dd61f4e93c6'; // Unified All Leads DB
const CONV_DB      = '325622d3e57481bbbaaedeb47e377f2c'; // Converted Leads 2026

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
  return null;
}

function mapLead(page) {
  const p = page.properties;
  return {
    id:          page.id,
    lastEdited:  page.last_edited_time,
    createdTime: page.created_time,
    db:          'leads',
    name:        getProp(p, 'Name',                  'title'),
    company:     getProp(p, 'Company',               'text'),
    email:       getProp(p, 'Email',                 'email'),
    location:    getProp(p, 'Location',              'text'),
    insta:       getProp(p, 'Insta',                 'text'),
    whatsapp:    getProp(p, 'WhatsApp',              'text'),
    website:     getProp(p, 'Website',               'text'),
    linkedin:    getProp(p, 'LinkedIn',              'text'),
    notes:       getProp(p, 'Notes',                 'text'),
    source:      getProp(p, 'Source',                'select'),
    status:      getProp(p, 'Status',                'select'),
    leadType:    getProp(p, 'Lead Type',             'select'),
    suitability: getProp(p, 'Suitability',           'select'),
    engagedFirst:getProp(p, 'Engaged First',         'date'),
    engagedLast: getProp(p, 'Engaged Last',          'date'),
    engageNext:  getProp(p, 'Engage Next',           'date'),
    salesCall:   getProp(p, 'Sales Call Booked Date','date'),
  };
}

function mapConverted(page) {
  const p = page.properties;
  return {
    id:          page.id,
    lastEdited:  page.last_edited_time,
    createdTime: page.created_time,
    db:          'converted',
    name:        getProp(p, 'Name',                         'title'),
    company:     getProp(p, 'Company',                      'text'),
    email:       getProp(p, 'Mail',                         'text'),
    location:    getProp(p, 'Location',                     'text'),
    insta:       getProp(p, 'Insta',                        'text'),
    website:     getProp(p, 'Website',                      'text'),
    whatsapp:    getProp(p, 'Whatsapp',                     'text'),
    notes:       getProp(p, 'Notes',                        'text'),
    contact:     getProp(p, "Who's in contact",             'text'),
    status:      getProp(p, 'Status',                       'multi_select'),
    suitability: getProp(p, 'Suitability',                  'select'),
    engageNext:  getProp(p, 'Engage Next',                  'date'),
    salesCall:   getProp(p, 'Sales Call/Visit Booked Date', 'date'),
  };
}

const cache = {};
const CACHE_TTL = 60 * 1000;

async function queryDB(dbId, mapper, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache[dbId] && (now - cache[dbId].ts) < CACHE_TTL) {
    return cache[dbId].data;
  }
  const results = [];
  let cursor;
  do {
    const body = {
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`DB query failed: ${await resp.text()}`);
    const data = await resp.json();
    results.push(...data.results.filter(p => !p.archived).map(mapper));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  cache[dbId] = { ts: now, data: results };
  return results;
}

async function updatePage(pageId, properties) {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers, body: JSON.stringify({ properties }),
  });
  if (!resp.ok) throw new Error(`Update failed: ${await resp.text()}`);
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body;
  try {

    if (action === 'load') {
      const force = req.body.forceRefresh === true;
      const [leads, converted] = await Promise.all([
        queryDB(ALL_LEADS_DB, mapLead,      force),
        queryDB(CONV_DB,      mapConverted, force),
      ]);
      return res.status(200).json({ leads, converted });
    }

    if (action === 'update') {
      const { pageId, db, status, notes, engageNext } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = {};
      if (notes !== undefined)
        props['Notes'] = { rich_text: [{ text: { content: notes } }] };
      if (engageNext !== undefined)
        props['Engage Next'] = engageNext ? { date: { start: engageNext } } : { date: null };
      if (status !== undefined) {
        if (db === 'leads')     props['Status'] = { select: { name: status } };
        else if (db === 'converted') props['Status'] = { multi_select: (Array.isArray(status) ? status : [status]).map(s => ({ name: s })) };
      }
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'updateDetails') {
      const { pageId, props } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'create') {
      const { name, company, email, insta, whatsapp, location, notes, source } = req.body;
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers,
        body: JSON.stringify({
          parent: { database_id: ALL_LEADS_DB },
          properties: {
            'Name':     { title:     [{ text: { content: name || '' } }] },
            'Company':  { rich_text: [{ text: { content: company || '' } }] },
            'Email':    { email: email || null },
            'Location': { rich_text: [{ text: { content: location || '' } }] },
            'Insta':    { rich_text: [{ text: { content: insta || '' } }] },
            'WhatsApp': { rich_text: [{ text: { content: whatsapp || '' } }] },
            'Notes':    { rich_text: [{ text: { content: notes || '' } }] },
            ...(source && { 'Source': { select: { name: source } } }),
            'Status': { select: { name: 'Followed + Engaged' } },
          },
        }),
      });
      if (!resp.ok) throw new Error(`Create failed: ${await resp.text()}`);
      const data = await resp.json();
      return res.status(200).json({ success: true, pageId: data.id });
    }

    if (action === 'promote') {
      const { pageId, name, company, email, insta, website, location, notes } = req.body;
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers,
        body: JSON.stringify({
          parent: { database_id: CONV_DB },
          properties: {
            'Name':     { title:     [{ text: { content: name || '' } }] },
            'Company':  { rich_text: [{ text: { content: company || '' } }] },
            'Mail':     { rich_text: [{ text: { content: email || '' } }] },
            'Insta':    { rich_text: [{ text: { content: insta || '' } }] },
            'Website':  { rich_text: [{ text: { content: website || '' } }] },
            'Location': { rich_text: [{ text: { content: location || '' } }] },
            'Notes':    { rich_text: [{ text: { content: notes || '' } }] },
            'Status':   { multi_select: [{ name: 'Responded' }] },
          },
        }),
      });
      if (!resp.ok) throw new Error(`Promote failed: ${await resp.text()}`);
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ archived: true }),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'delete') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ archived: true }),
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[crm]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
