// api/notion-load.js
// Fetches recent entries from the Contracts Retreat Leaders database.
// Returns lastEdited timestamp for display in the Drafts tab.

const DB_ID = '978a217d69ae41bf9ca7ba9f5737ca3c';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const resp = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 20,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();

    const drafts = data.results.map(page => {
      const p = page.properties;
      const getProp = (name, type) => {
        const prop = p[name];
        if (!prop) return null;
        if (type === 'title')  return prop.title?.[0]?.plain_text || null;
        if (type === 'text')   return prop.rich_text?.[0]?.plain_text || null;
        if (type === 'number') return prop.number ?? null;
        if (type === 'date')   return prop.date?.start || null;
        if (type === 'select') return prop.select?.name || null;
        if (type === 'url')    return prop.url || null;
        return null;
      };

      return {
        pageId:      page.id,
        lastEdited:  page.last_edited_time,
        organizer:   getProp('Organizer',    'title'),
        retreatName: getProp('Retreat Name', 'text'),
        checkin:     getProp('Check-in',     'date'),
        checkout:    getProp('Check-out',    'date'),
        nights:      getProp('Nights',       'number'),
        guests:      getProp('Guests',       'number'),
        totalUSD:    getProp('Total USD',    'number'),
        status:      getProp('Status',       'select'),
        formState:   getProp('Form State',   'text'),
      };
    });

    return res.status(200).json({ drafts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
