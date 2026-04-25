// api/data.js — unified data layer
// POST { db:'offers', action } → Offers DB CRUD        (was api/notion.js)
// POST { db:'crm',   action } → CRM DB CRUD            (was api/crm.js)
// POST { action:'clearReachedOut' }                     (was api/clear-reached-out.js)
// GET  ?action=drift / POST { action:'drift' }          (was api/drift-detector.js)

export const config = { maxDuration: 60 };

const OFFERS_DB = '978a217d69ae41bf9ca7ba9f5737ca3c';
const CRM_DB    = '34a622d3e57481738b3ce70824a6adf7';

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type':   'application/json',
  };
}

// ── OFFERS DB ─────────────────────────────────────────────────────────────────

function toRichTextBlocks(str) {
  const s = str || '';
  const chunks = [];
  for (let i = 0; i < s.length; i += 2000) {
    chunks.push({ text: { content: s.slice(i, i + 2000) } });
  }
  return chunks.length > 0 ? chunks : [{ text: { content: '' } }];
}

function fromRichText(prop) {
  if (!prop?.rich_text) return null;
  return prop.rich_text.map(b => b.plain_text).join('') || null;
}

function buildOfferProperties(body) {
  const { organizer, retreatName, checkin, checkout, contractDate, rooms, nights, guests, totalUSD, status, formState } = body;
  return {
    'Organizer':    { title:     [{ text: { content: organizer   || '' } }] },
    'Retreat Name': { rich_text: [{ text: { content: retreatName || '' } }] },
    'Form State':   { rich_text: toRichTextBlocks(formState) },
    'Rooms':        { number: rooms    ? Number(rooms)    : null },
    'Nights':       { number: nights   ? Number(nights)   : null },
    'Guests':       { number: guests   ? Number(guests)   : null },
    'Total USD':    { number: totalUSD ? Number(totalUSD) : null },
    'Status':       { select: { name: status || 'Draft' } },
    ...(checkin      && { 'Check-in':      { date: { start: checkin } } }),
    ...(checkout     && { 'Check-out':     { date: { start: checkout } } }),
    ...(contractDate && { 'Contract Date': { date: { start: contractDate } } }),
  };
}

async function notionErrorObj(resp) {
  try {
    const body = await resp.json();
    return { error: body.message || `HTTP ${resp.status}`, notion_code: body.code || null, notion_status: resp.status };
  } catch {
    return { error: `HTTP ${resp.status}`, notion_code: null, notion_status: resp.status };
  }
}

async function handleOffers(action, req, res) {
  const hdrs = notionHeaders();
  const { pageId } = req.body;
  console.log('[data/offers] action:', action, '| pageId:', pageId || 'none');
  try {
    if (action === 'load') {
      const resp = await fetch(`https://api.notion.com/v1/databases/${OFFERS_DB}/query`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }], page_size: 20 }),
      });
      if (!resp.ok) {
        const err = await notionErrorObj(resp);
        console.error('[data/offers] load failed:', err.notion_status, err.notion_code, err.error);
        return res.status(resp.status).json(err);
      }
      const data = await resp.json();
      const getProp = (p, name, type) => {
        const prop = p[name];
        if (!prop) return null;
        if (type === 'title')  return prop.title?.[0]?.plain_text  || null;
        if (type === 'text')   return fromRichText(prop);
        if (type === 'number') return prop.number ?? null;
        if (type === 'date')   return prop.date?.start || null;
        if (type === 'select') return prop.select?.name || null;
        return null;
      };
      const drafts = data.results.map(page => ({
        pageId:      page.id,
        lastEdited:  page.last_edited_time,
        organizer:   getProp(page.properties, 'Organizer',    'title'),
        retreatName: getProp(page.properties, 'Retreat Name', 'text'),
        checkin:     getProp(page.properties, 'Check-in',     'date'),
        checkout:    getProp(page.properties, 'Check-out',    'date'),
        nights:      getProp(page.properties, 'Nights',       'number'),
        guests:      getProp(page.properties, 'Guests',       'number'),
        totalUSD:    getProp(page.properties, 'Total USD',    'number'),
        status:      getProp(page.properties, 'Status',       'select'),
        formState:   getProp(page.properties, 'Form State',   'text'),
      }));
      console.log('[data/offers] loaded', drafts.length, 'drafts');
      return res.status(200).json({ drafts });
    }

    if (action === 'create') {
      const props = buildOfferProperties(req.body);
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ parent: { database_id: OFFERS_DB }, properties: props }),
      });
      if (!resp.ok) {
        const err = await notionErrorObj(resp);
        console.error('[data/offers] create failed:', err.notion_status, err.notion_code, err.error);
        return res.status(resp.status).json(err);
      }
      const data = await resp.json();
      return res.status(200).json({ success: true, pageId: data.id });
    }

    if (action === 'update') {
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = buildOfferProperties(req.body);
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ properties: props }),
      });
      if (!resp.ok) {
        const err = await notionErrorObj(resp);
        console.error('[data/offers] update failed:', err.notion_status, err.notion_code, err.error);
        return res.status(resp.status).json(err);
      }
      return res.status(200).json({ success: true, pageId });
    }

    if (action === 'delete') {
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ in_trash: true }),
      });
      if (!resp.ok) {
        const err = await notionErrorObj(resp);
        console.error('[data/offers] delete failed:', err.notion_status, err.notion_code, err.error);
        return res.status(resp.status).json(err);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown offers action: ${action}` });
  } catch (err) {
    console.error('[data/offers] caught error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── CRM DB ────────────────────────────────────────────────────────────────────

function getCRMProp(props, name, type) {
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
  const source    = getCRMProp(p, 'Source',    'select');
  const converted = p['Converted']?.checkbox || false;
  return {
    id:           page.id,
    lastEdited:   page.last_edited_time,
    db:           converted ? 'converted' : (source || 'Email').toLowerCase(),
    source,
    name:         getCRMProp(p, 'Name',                         'title'),
    company:      getCRMProp(p, 'Company',                      'text'),
    email:        getCRMProp(p, 'Email',                        'email'),
    location:     getCRMProp(p, 'Location',                     'text'),
    insta:        getCRMProp(p, 'Insta',                        'text'),
    website:      getCRMProp(p, 'Website',                      'text'),
    linkedin:     getCRMProp(p, 'LinkedIn',                     'text'),
    whatsapp:     getCRMProp(p, 'Whatsapp',                     'text'),
    whatsapp2:    getCRMProp(p, 'Whatsapp 2',                   'text'),
    notes:        getCRMProp(p, 'Notes',                        'text'),
    status:       getCRMProp(p, 'Status',                       'select'),
    suitability:  getCRMProp(p, 'Suitability',                  'select'),
    reachedOutOn: getCRMProp(p, 'Reached out on',               'multi_select') || [],
    engagedFirst: getCRMProp(p, 'Engaged first',                'date'),
    engagedLast:  getCRMProp(p, 'Engaged last',                 'date'),
    engageNext:   getCRMProp(p, 'Engage Next',                  'date'),
    salesCall:    getCRMProp(p, 'Sales Call/Visit Booked Date', 'date'),
    contact:      getCRMProp(p, 'Contact',                      'text'),
  };
}

async function crmQueryAll(hdrs) {
  const results = [];
  let cursor;
  do {
    const body = { page_size: 100, sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }] };
    if (cursor) body.start_cursor = cursor;
    const resp = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: 'POST', headers: hdrs, body: JSON.stringify(body),
    });
    if (!resp.ok) await notionThrow(resp, 'CRM query');
    const data = await resp.json();
    results.push(...data.results.map(mapLead));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function crmUpdatePage(pageId, properties, hdrs) {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers: hdrs, body: JSON.stringify({ properties }),
  });
  if (!resp.ok) await notionThrow(resp, 'Update failed');
  return resp.json();
}

const rt = s => ({ rich_text: [{ text: { content: s || '' } }] });
const dt = s => s ? { date: { start: s } } : { date: null };

async function handleCRM(action, req, res) {
  const hdrs = notionHeaders();
  try {
    if (action === 'load') {
      const all = await crmQueryAll(hdrs);
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
      await crmUpdatePage(pageId, props, hdrs);
      return res.status(200).json({ success: true });
    }

    if (action === 'updateReachedOut') {
      const { pageId, reachedOutOn } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await crmUpdatePage(pageId, {
        'Reached out on': { multi_select: (reachedOutOn || []).map(v => ({ name: v })) },
      }, hdrs);
      return res.status(200).json({ success: true });
    }

    if (action === 'updateDetails') {
      const { pageId, name, company, location, email, insta, website,
              notes, linkedin, whatsapp, whatsapp2, engagedFirst, engageNext, suitability } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = {};
      if (name         !== undefined) props['Name']          = { title: [{ text: { content: name || '' } }] };
      if (company      !== undefined) props['Company']       = rt(company);
      if (location     !== undefined) props['Location']      = rt(location);
      if (email        !== undefined) props['Email']         = { email: email || null };
      if (insta        !== undefined) props['Insta']         = rt(insta);
      if (website      !== undefined) props['Website']       = rt(website);
      if (notes        !== undefined) props['Notes']         = rt(notes);
      if (linkedin     !== undefined) props['LinkedIn']      = rt(linkedin);
      if (whatsapp     !== undefined) props['Whatsapp']      = rt(whatsapp);
      if (whatsapp2    !== undefined) props['Whatsapp 2']    = rt(whatsapp2);
      if (engagedFirst !== undefined) props['Engaged first'] = dt(engagedFirst);
      if (engageNext   !== undefined) props['Engage Next']   = dt(engageNext);
      if (suitability  !== undefined) props['Suitability']   = suitability ? { select: { name: suitability } } : { select: null };
      await crmUpdatePage(pageId, props, hdrs);
      return res.status(200).json({ success: true });
    }

    if (action === 'create') {
      const { db: targetDb, name, company, email, insta, whatsapp, location, notes, status } = req.body;
      const sourceMap = { whatsapp: 'WhatsApp', shala: 'Shala', email: 'Email' };
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST', headers: hdrs,
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
        method: 'PATCH', headers: hdrs, body: JSON.stringify({ in_trash: true }),
      });
      if (!resp.ok) await notionThrow(resp, 'Delete failed');
      return res.status(200).json({ success: true });
    }

    if (action === 'promote') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await crmUpdatePage(pageId, { 'Converted': { checkbox: true } }, hdrs);
      return res.status(200).json({ success: true });
    }

    if (action === 'demote') {
      const { pageId } = req.body;
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      await crmUpdatePage(pageId, { 'Converted': { checkbox: false } }, hdrs);
      return res.status(200).json({ success: true, pageId });
    }

    return res.status(400).json({ error: `Unknown CRM action: ${action}` });
  } catch (err) {
    console.error('[data/crm]', err.message, err.notion_code || '');
    return res.status(err.notion_status || 500).json({
      error:         err.message,
      notion_code:   err.notion_code   || null,
      notion_status: err.notion_status || null,
    });
  }
}

// ── CLEAR REACHED OUT ─────────────────────────────────────────────────────────

async function handleClearReachedOut(req, res) {
  const hdrs = notionHeaders();
  const dry = req.body?.dry === true || req.query?.dry === '1';
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const since = yesterday.toISOString().slice(0, 10);

  const leads    = await fetchLeadsSince(since, hdrs);
  const toUpdate = leads.filter(l => l.reachedOutOn.length > 0);

  if (!dry) {
    await Promise.all(toUpdate.map(l =>
      fetch(`https://api.notion.com/v1/pages/${l.pageId}`, {
        method: 'PATCH', headers: hdrs,
        body: JSON.stringify({ properties: { 'Reached out on': { multi_select: [] } } }),
      })
    ));
  }

  return res.json({
    since, total: leads.length, cleared: toUpdate.length, dry,
    rows: leads.map(l => ({
      name: l.name, engagedFirst: l.engagedFirst, hadChannels: l.reachedOutOn,
      cleared: !dry && toUpdate.includes(l),
    })),
  });
}

async function fetchLeadsSince(since, hdrs) {
  const leads = [];
  let cursor;
  do {
    const body = {
      filter: { property: 'Engaged first', date: { on_or_after: since } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB}/query`, {
      method: 'POST', headers: hdrs, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.object === 'error') throw new Error(d.message);
    for (const page of d.results || []) {
      const p = page.properties;
      leads.push({
        pageId:       page.id,
        name:         p['Name']?.title?.[0]?.plain_text || '',
        engagedFirst: p['Engaged first']?.date?.start || '',
        reachedOutOn: (p['Reached out on']?.multi_select || []).map(s => s.name),
      });
    }
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return leads;
}

// ── DRIFT DETECTOR ────────────────────────────────────────────────────────────

const EXPECTED_SCHEMAS = [
  {
    id: OFFERS_DB, label: 'Offers DB', source: 'api/data.js',
    props: {
      'Organizer': 'title', 'Retreat Name': 'rich_text', 'Form State': 'rich_text',
      'Rooms': 'number', 'Nights': 'number', 'Guests': 'number', 'Total USD': 'number',
      'Status': 'select', 'Check-in': 'date', 'Check-out': 'date', 'Contract Date': 'date',
    },
  },
  {
    id: CRM_DB, label: 'CRM DB (unified)', source: 'api/data.js',
    props: {
      'Name': 'title', 'Source': 'select', 'Converted': 'checkbox',
      'Company': 'rich_text', 'Email': 'email', 'LinkedIn': 'rich_text',
      'Location': 'rich_text', 'Insta': 'rich_text', 'Website': 'rich_text',
      'Whatsapp': 'rich_text', 'Whatsapp 2': 'rich_text', 'Notes': 'rich_text',
      'Contact': 'rich_text', 'Status': 'select', 'Suitability': 'select',
      'Reached out on': 'multi_select', 'Engaged first': 'date', 'Engaged last': 'date',
      'Engage Next': 'date', 'Sales Call/Visit Booked Date': 'date',
    },
  },
];

async function handleDrift(res) {
  if (!process.env.NOTION_TOKEN) return res.status(500).json({ error: 'NOTION_TOKEN not set' });
  const hdrs = { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' };

  async function checkDB({ id, label, source, props }) {
    const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { headers: hdrs });
    if (!r.ok) return [{ db: label, source, property: '(database)', issue: `unreachable HTTP ${r.status}` }];
    const schema = (await r.json()).properties || {};
    const drifts = [];
    for (const [name, expectedType] of Object.entries(props)) {
      if (!schema[name]) {
        drifts.push({ db: label, source, property: name, issue: 'missing' });
      } else if (schema[name].type !== expectedType) {
        drifts.push({ db: label, source, property: name,
          issue: `type changed: expected ${expectedType}, got ${schema[name].type}` });
      }
    }
    return drifts;
  }

  const drifts    = (await Promise.all(EXPECTED_SCHEMAS.map(checkDB))).flat();
  const checkedAt = new Date().toISOString();
  if (drifts.length > 0) console.warn('[data/drift] DRIFT:', JSON.stringify(drifts));
  else console.log(`[data/drift] all OK — ${EXPECTED_SCHEMAS.length} databases checked at ${checkedAt}`);
  return res.status(200).json({ ok: drifts.length === 0, checked: EXPECTED_SCHEMAS.length, drifts, checkedAt });
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query?.action === 'drift') return handleDrift(res);
    return res.status(400).json({ error: 'Unknown GET action' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, store } = req.body || {};
  if (store === 'offers')           return handleOffers(action, req, res);
  if (store === 'crm')              return handleCRM(action, req, res);
  if (action === 'clearReachedOut') return handleClearReachedOut(req, res);
  if (action === 'drift')           return handleDrift(res);
  return res.status(400).json({ error: `Unknown request: store=${store} action=${action}` });
}
