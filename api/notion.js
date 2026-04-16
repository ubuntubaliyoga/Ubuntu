// api/notion.js
const DB_ID = '978a217d69ae41bf9ca7ba9f5737ca3c';

const headers = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Notion rich_text blocks have a 2000-char limit — chunk into multiple blocks
function toRichTextBlocks(str) {
  const s = str || '';
  const chunks = [];
  for (let i = 0; i < s.length; i += 2000) {
    chunks.push({ text: { content: s.slice(i, i + 2000) } });
  }
  return chunks.length > 0 ? chunks : [{ text: { content: '' } }];
}

// Reassemble all rich_text blocks back into one string
function fromRichText(prop) {
  if (!prop?.rich_text) return null;
  return prop.rich_text.map(b => b.plain_text).join('') || null;
}

function buildProperties(body) {
  const {
    organizer, retreatName, checkin, checkout,
    contractDate, rooms, nights, guests,
    totalUSD, status, formState,
  } = body;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, pageId } = req.body;
  console.log('[notion] action:', action, '| pageId:', pageId || 'none');

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
      if (!resp.ok) {
        const text = await resp.text();
        console.error('[notion] load failed:', resp.status, text);
        return res.status(resp.status).json({ error: text });
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

      console.log('[notion] loaded', drafts.length, 'drafts');
      return res.status(200).json({ drafts });
    }

    // ── CREATE ─────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const props = buildProperties(req.body);
      console.log('[notion] creating | formState blocks:', props['Form State'].rich_text.length);
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: DB_ID },
          properties: props,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error('[notion] create failed:', resp.status, text);
        return res.status(resp.status).json({ error: text });
      }
      const data = await resp.json();
      console.log('[notion] created:', data.id);
      return res.status(200).json({ success: true, pageId: data.id });
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
      const props = buildProperties(req.body);
      console.log('[notion] updating:', pageId, '| formState blocks:', props['Form State'].rich_text.length);
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties: props }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error('[notion] update failed:', resp.status, text);
        return res.status(resp.status).json({ error: text });
      }
      console.log('[notion] updated:', pageId);
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
      if (!resp.ok) {
        const text = await resp.text();
        console.error('[notion] delete failed:', resp.status, text);
        return res.status(resp.status).json({ error: text });
      }
      console.log('[notion] deleted:', pageId);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[notion] caught error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
