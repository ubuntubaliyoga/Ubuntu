// api/crm.js — unified CRM (single Notion database, Source + Converted fields)

const CRM_DB = '34a622d3e57481738b3ce70824a6adf7';

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

async function notionThrow(resp, label) {
  let body;
  try { body = await resp.json(); } catch { body = {}; }
  const msg = body.message || `HTTP ${resp.status}`;
  const err = new Error(`${label}: ${msg}`);
  err.notion_code   = body.code   || null;
  err.notion_status = resp.status;
  throw err;
}

function mapLead(page) {
  const p         = page.properties;
  const source    = getProp(p, 'Source',    'select');
  const converted = p['Converted']?.checkbox || false;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           converted ? 'converted' : (source || 'Email').toLowerCase(),
    source,
    name:         getProp(p, 'Name',                         'title'),
    company:      getProp(p, 'Company',                      'text'),
    email:        getProp(p, 'Email',                        'email'),
    location:     getProp(p, 'Location',                     'text'),
    insta:        getProp(p, 'Insta',                        'text'),
    website:      getProp(p, 'Website',                      'text'),
    linkedin:     getProp(p, 'LinkedIn',                     'text'),
    whatsapp:     getProp(p, 'Whatsapp',                     'text'),
    whatsapp2:    getProp(p, 'Whatsapp 2',                   'text'),
    notes:        getProp(p, 'Notes',                        'text'),
    status:       getProp(p, 'Status',                       'select'),
    suitability:  getProp(p, 'Suitability',                  'select'),
    reachedOutOn: getProp(p, 'Reached out on',               'multi_select') || [],
    engagedFirst: getProp(p, 'Engaged first',                'date'),
    engagedLast:  getProp(p, 'Engaged last',                 'date'),
    engageNext:   getProp(p, 'Engage Next',                  'date'),
    salesCall:    getProp(p, 'Sales Call/Visit Booked Date', 'date'),
    contact:      getProp(p, 'Contact',                      'text'),
  };
}

async function queryAll() {
  const results = [];
  let cursor;
  do {
    const body = { page_size: 100, sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }] };
    if (cursor) body.start_cursor = cursor;
    const resp = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!resp.ok) await notionThrow(resp, 'CRM query');
    const data = await resp.json();
    results.push(...data.results.map(mapLead));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function updatePage(pageId, properties) {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers, body: JSON.stringify({ properties }),
  });
  if (!resp.ok) await notionThrow(resp, 'Update failed');
  return resp.json();
}

const rt = s => ({ rich_text: [{ text: { content: s || '' } }] });
const dt = s => s ? { date: { start: s } } : { date: null };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body;

  try {

    if (action === 'load') {
      const all = await queryAll();
      return res.status(200).json({
        emailLeads:    all.filter(l => l.db === 'email'),
        whatsappLeads: all.filter(l => l.db === 'whatsapp'),
        shalaLeads:    all.filter(l => l.db === 'shala'),
        converted:     all.filter(l => l.db === 'converted'),
      });
    }

    if (action === 'update') {
      const { pageId, status, notes, engageNext } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = {};
      if (notes      !== undefined) props['Notes']       = rt(notes);
      if (engageNext !== undefined) props['Engage Next'] = dt(engageNext);
      if (status     !== undefined) {
        const s = Array.isArray(status) ? status[0] : status;
        props['Status'] = s ? { select: { name: s } } : { select: null };
      }
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'updateReachedOut') {
      const { pageId, reachedOutOn } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await updatePage(pageId, {
        'Reached out on': { multi_select: (reachedOutOn || []).map(v => ({ name: v })) },
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'updateDetails') {
      const { pageId, name, company, location, email, insta, website,
              notes, linkedin, whatsapp, whatsapp2, engagedFirst, engageNext, suitability } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = {};
      if (name         !== undefined) props['Name']         = { title: [{ text: { content: name || '' } }] };
      if (company      !== undefined) props['Company']      = rt(company);
      if (location     !== undefined) props['Location']     = rt(location);
      if (email        !== undefined) props['Email']        = { email: email || null };
      if (insta        !== undefined) props['Insta']        = rt(insta);
      if (website      !== undefined) props['Website']      = rt(website);
      if (notes        !== undefined) props['Notes']        = rt(notes);
      if (linkedin     !== undefined) props['LinkedIn']     = rt(linkedin);
      if (whatsapp     !== undefined) props['Whatsapp']     = rt(whatsapp);
      if (whatsapp2    !== undefined) props['Whatsapp 2']   = rt(whatsapp2);
      if (engagedFirst !== undefined) props['Engaged first'] = dt(engagedFirst);
      if (engageNext   !== undefined) props['Engage Next']  = dt(engageNext);
      if (suitability  !== undefined) props['Suitability']  = suitability ? { select: { name: suitability } } : { select: null };
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'create') {
      const { db: targetDb, name, company, email, insta, whatsapp, location, notes, status } = req.body;
      const sourceMap = { whatsapp: 'WhatsApp', shala: 'Shala', email: 'Email' };
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers,
        body: JSON.stringify({
          parent: { database_id: CRM_DB },
          properties: {
            'Name':     { title: [{ text: { content: name || '' } }] },
            'Source':   { select: { name: sourceMap[targetDb] || 'Email' } },
            'Company':  rt(company),
            'Email':    { email: email || null },
            'Insta':    rt(insta),
            'Location': rt(location),
            'Notes':    rt(notes),
            ...(whatsapp && { 'Whatsapp': rt(whatsapp) }),
            ...(status   && { 'Status':   { select: { name: status } } }),
          },
        }),
      });
      if (!resp.ok) await notionThrow(resp, 'Create failed');
      const data = await resp.json();
      return res.status(200).json({ success: true, pageId: data.id });
    }

    if (action === 'delete') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ in_trash: true }),
      });
      if (!resp.ok) await notionThrow(resp, 'Delete failed');
      return res.status(200).json({ success: true });
    }

    // promote: was trash+recreate across DBs — now just flips a checkbox
    if (action === 'promote') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await updatePage(pageId, { 'Converted': { checkbox: true } });
      return res.status(200).json({ success: true });
    }

    // demote: same — just flip the checkbox back
    if (action === 'demote') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await updatePage(pageId, { 'Converted': { checkbox: false } });
      return res.status(200).json({ success: true, pageId });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[crm]', err.message, err.notion_code || '');
    return res.status(err.notion_status || 500).json({
      error:         err.message,
      notion_code:   err.notion_code   || null,
      notion_status: err.notion_status || null,
    });
  }
}
