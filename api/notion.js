// api/notion.js
// Single endpoint handling all Notion operations.
// Body must include: { action: 'create' | 'update' | 'delete' | 'load', ...fields }

const DB_ID = '978a217d69ae41bf9ca7ba9f5737ca3c';

const headers = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function buildProperties(body) {
  const {
    organizer, retreatName, checkin, checkout,
    contractDate, rooms, nights, guests,
    totalUSD, status, formState,
  } = body;
  return {
    'Organizer':    { title:     [{ text: { content: organizer   || '' } }] },
    'Retreat Name': { rich_text: [{ text: { content: retreatName || '' } }] },
    'Form State':   { rich_text: [{ text: { content: formState   || '' } }] },
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, pageId } = req.body;

  try {

    // ── LOAD ──────────────────────────────────────────────────────────────────
    if (action === 'load') {
      const resp = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
          page_size: 20,
        }),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
      const data = await resp.json();

      const getProp = (p, name, type) => {
        const prop = p[name];
        if (!prop) return null;
        if (type === 'title')  return prop.title?.[0]?.plain_text  || null;
        if (type === 'text')   return prop.rich_text?.[0]?.plain_text || null;
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

      return res.status(200).json({ drafts });
    }

    // ── CREATE ─────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: DB_ID },
          properties: buildProperties(req.body),
        }),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
      const data = await resp.json();
      return res.status(200).json({ success: true, pageId: data.id });
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties: buildProperties(req.body) }),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
      return res.status(200).json({ success: true, pageId });
    }

    // ── DELETE (trash) ─────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ in_trash: true }),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
