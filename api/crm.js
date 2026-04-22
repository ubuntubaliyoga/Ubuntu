// api/crm.js

const EMAIL_DB    = '8e5622d3e57482ba950081ac7695672e';
const WHATSAPP_DB = '320622d3e5748066b6dfcea95816fad2';
const SHALA_DB    = '320622d3e57480608324f0eb4d3b8a2c';
const CONV_DB     = '325622d3e57481bbbaaedeb47e377f2c';

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

function mapEmailLead(page) {
  const p = page.properties;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           'email',
    name:         getProp(p, 'Name',                   'title'),
    company:      getProp(p, 'Company',                'text'),
    email:        getProp(p, 'Email',                  'email'),
    location:     getProp(p, 'Location',               'text'),
    insta:        getProp(p, 'Insta',                  'text'),
    website:      getProp(p, 'Website',                'text'),
    linkedin:     getProp(p, 'Linkydinky',             'text'),
    notes:        getProp(p, 'Notes',                  'text'),
    status:       getProp(p, 'Instagram',              'select'),
    suitability:  getProp(p, 'Suitability',            'select'),
    reachedOutOn: getProp(p, 'Reached out on',         'multi_select'),
    engagedFirst: getProp(p, 'Engaged first',          'date'),
    engagedLast:  getProp(p, 'Engaged last',           'date'),
    engageNext:   getProp(p, 'Engage Next',            'date'),
    salesCall:    getProp(p, 'Sales Call Booked Date', 'date'),
  };
}

function mapWhatsappLead(page) {
  const p = page.properties;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           'whatsapp',
    name:         getProp(p, 'Name',                         'title'),
    company:      getProp(p, 'Company',                      'text'),
    email:        getProp(p, 'Mail',                         'text'),
    location:     getProp(p, 'Location',                     'text'),
    insta:        getProp(p, 'Insta',                        'text'),
    website:      getProp(p, 'Website',                      'text'),
    whatsapp:     getProp(p, 'Whatsapp 1',                   'text'),
    whatsapp2:    getProp(p, 'Whatsapp 2',                   'text'),
    notes:        getProp(p, 'Notes',                        'text'),
    status:       getProp(p, 'Multi-select',                 'select'),
    suitability:  getProp(p, 'Suitability',                  'select'),
    reachedOutOn: ['WhatsApp'],
    engagedFirst: getProp(p, 'Engaged first',                'text'),
    engageNext:   getProp(p, 'Engage Next',                  'date'),
    salesCall:    getProp(p, 'Sales Call/Visit Booked Date', 'date'),
  };
}

function mapShalaLead(page) {
  const p = page.properties;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           'shala',
    name:         getProp(p, 'Name',                         'title'),
    company:      getProp(p, 'Company',                      'text'),
    email:        getProp(p, 'Mail',                         'text'),
    location:     getProp(p, 'Location',                     'text'),
    insta:        getProp(p, 'Insta',                        'text'),
    website:      getProp(p, 'Website',                      'text'),
    whatsapp:     getProp(p, 'Whatsapp',                     'text'),
    notes:        getProp(p, 'Notes',                        'text'),
    status:       null,
    suitability:  getProp(p, 'Suitability',                  'select'),
    reachedOutOn: ['WhatsApp'],
    engagedFirst: getProp(p, 'Engaged first',                'text'),
    engageNext:   getProp(p, 'Engage Next',                  'date'),
    salesCall:    getProp(p, 'Sales Call/Visit Booked Date', 'date'),
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
    reachedOutOn: [],
    engageNext:   getProp(p, 'Engage Next',                  'date'),
    salesCall:    getProp(p, 'Sales Call/Visit Booked Date', 'date'),
  };
}

async function notionThrow(resp, label) {
  let body;
  try { body = await resp.json(); } catch { body = {}; }
  const msg = body.message || `HTTP ${resp.status}`;
  const err = new Error(`${label}: ${msg}`);
  err.notion_code = body.code || null;
  err.notion_status = resp.status;
  throw err;
}

async function queryDB(dbId, mapper) {
  const results = [];
  let cursor = undefined;

  do {
    const body = {
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) await notionThrow(resp, `DB query failed (${dbId})`);
    const data = await resp.json();
    results.push(...data.results.map(mapper));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

async function updatePage(pageId, properties) {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties }),
  });
  if (!resp.ok) await notionThrow(resp, 'Update failed');
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body;

  try {

    if (action === 'load') {
      const [emailLeads, whatsappLeads, shalaLeads, converted] = await Promise.all([
        queryDB(EMAIL_DB,    mapEmailLead),
        queryDB(WHATSAPP_DB, mapWhatsappLead),
        queryDB(SHALA_DB,    mapShalaLead),
        queryDB(CONV_DB,     mapConverted),
      ]);
      return res.status(200).json({ emailLeads, whatsappLeads, shalaLeads, converted });
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
        if (db === 'converted')
          props['Status'] = { multi_select: (Array.isArray(status) ? status : [status]).map(s => ({ name: s })) };
        else if (db === 'email')
          props['Instagram'] = { select: { name: status } };
        else if (db === 'whatsapp')
          props['Multi-select'] = { select: { name: status } };
      }
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'updateReachedOut') {
      const { pageId, db, reachedOutOn } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      if (db === 'email') {
        await updatePage(pageId, {
          'Reached out on': { multi_select: (reachedOutOn || []).map(v => ({ name: v })) },
        });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'updateDetails') {
      const { pageId, db, name, company, location, email, insta, website, notes,
              linkedin, whatsapp, whatsapp2, engagedFirst, engageNext, suitability } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = {};
      if (name     !== undefined) props['Name']     = { title:     [{ text: { content: name || '' } }] };
      if (company  !== undefined) props['Company']  = { rich_text: [{ text: { content: company || '' } }] };
      if (location !== undefined) props['Location'] = { rich_text: [{ text: { content: location || '' } }] };
      if (insta    !== undefined) props['Insta']    = { rich_text: [{ text: { content: insta || '' } }] };
      if (website  !== undefined) props['Website']  = { rich_text: [{ text: { content: website || '' } }] };
      if (email !== undefined) {
        if (db === 'email') props['Email'] = { email: email || null };
        else                props['Mail']  = { rich_text: [{ text: { content: email || '' } }] };
      }
      if (notes !== undefined)
        props['Notes'] = { rich_text: [{ text: { content: notes || '' } }] };
      if (linkedin !== undefined && db === 'email')
        props['Linkydinky'] = { rich_text: [{ text: { content: linkedin || '' } }] };
      if (whatsapp !== undefined) {
        if (db === 'whatsapp')                       props['Whatsapp 1'] = { rich_text: [{ text: { content: whatsapp || '' } }] };
        else if (db === 'shala' || db === 'converted') props['Whatsapp']   = { rich_text: [{ text: { content: whatsapp || '' } }] };
      }
      if (whatsapp2 !== undefined && db === 'whatsapp')
        props['Whatsapp 2'] = { rich_text: [{ text: { content: whatsapp2 || '' } }] };
      if (engagedFirst !== undefined) {
        if (db === 'email') props['Engaged first'] = engagedFirst ? { date: { start: engagedFirst } } : { date: null };
        else                props['Engaged first'] = { rich_text: [{ text: { content: engagedFirst || '' } }] };
      }
      if (engageNext !== undefined)
        props['Engage Next'] = engageNext ? { date: { start: engageNext } } : { date: null };
      if (suitability !== undefined)
        props['Suitability'] = suitability ? { select: { name: suitability } } : { select: null };
      await updatePage(pageId, props);
      return res.status(200).json({ success: true });
    }

    if (action === 'create') {
      const { db: targetDb, name, company, email, insta, whatsapp, location, notes, status } = req.body;
      let dbId, properties;
      if (targetDb === 'whatsapp') {
        dbId = WHATSAPP_DB;
        properties = {
          'Name':       { title:     [{ text: { content: name || '' } }] },
          'Company':    { rich_text: [{ text: { content: company || '' } }] },
          'Insta':      { rich_text: [{ text: { content: insta || '' } }] },
          'Whatsapp 1': { rich_text: [{ text: { content: whatsapp || '' } }] },
          'Location':   { rich_text: [{ text: { content: location || '' } }] },
        };
      } else if (targetDb === 'shala') {
        dbId = SHALA_DB;
        properties = {
          'Name':     { title:     [{ text: { content: name || '' } }] },
          'Company':  { rich_text: [{ text: { content: company || '' } }] },
          'Insta':    { rich_text: [{ text: { content: insta || '' } }] },
          'Whatsapp': { rich_text: [{ text: { content: whatsapp || '' } }] },
          'Mail':     { rich_text: [{ text: { content: email || '' } }] },
          'Location': { rich_text: [{ text: { content: location || '' } }] },
        };
      } else {
        dbId = EMAIL_DB;
        properties = {
          'Name':     { title:     [{ text: { content: name || '' } }] },
          'Company':  { rich_text: [{ text: { content: company || '' } }] },
          'Email':    { email: email || null },
          'Insta':    { rich_text: [{ text: { content: insta || '' } }] },
          'Location': { rich_text: [{ text: { content: location || '' } }] },
          'Notes':    { rich_text: [{ text: { content: notes || '' } }] },
          ...(status && { 'Instagram': { select: { name: status } } }),
        };
      }
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers,
        body: JSON.stringify({ parent: { database_id: dbId }, properties }),
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

    if (action === 'promote') {
      const { pageId, name, company, email, insta, website, location, notes } = req.body;
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ in_trash: true }),
      });
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
          },
        }),
      });
      if (!resp.ok) await notionThrow(resp, 'Promote failed');
      return res.status(200).json({ success: true });
    }

    if (action === 'demote') {
      const { pageId, name, company, email, insta, website, location, notes } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ in_trash: true }),
      });
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers,
        body: JSON.stringify({
          parent: { database_id: EMAIL_DB },
          properties: {
            'Name':     { title:     [{ text: { content: name || '' } }] },
            'Company':  { rich_text: [{ text: { content: company || '' } }] },
            'Email':    { email: email || null },
            'Insta':    { rich_text: [{ text: { content: insta || '' } }] },
            'Website':  { rich_text: [{ text: { content: website || '' } }] },
            'Location': { rich_text: [{ text: { content: location || '' } }] },
            'Notes':    { rich_text: [{ text: { content: notes || '' } }] },
          },
        }),
      });
      if (!resp.ok) await notionThrow(resp, 'Demote failed');
      const data = await resp.json();
      return res.status(200).json({ success: true, pageId: data.id });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[crm]', err.message, err.notion_code || '');
    return res.status(err.notion_status || 500).json({
      error: err.message,
      notion_code: err.notion_code || null,
      notion_status: err.notion_status || null,
    });
  }
}
