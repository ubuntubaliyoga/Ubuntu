// api/crm.js
const LEAD_DB    = '8e5622d3e57482ba950081ac7695672e';
const CONV_DB    = '325622d3e57481bbbaaedeb47e377f2c';

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
    id: page.id,
    lastEdited: page.last_edited_time,
    db: 'leads',
    name: getProp(p, 'Name', 'title'),
    company: getProp(p, 'Company', 'text'),
    email: getProp(p, 'Email', 'email'),
    status: getProp(p, 'Instagram', 'select'),
    suitability: getProp(p, 'Suitability', 'select'),
  };
}

function mapConverted(page) {
  const p = page.properties;
  return {
    id: page.id,
    lastEdited: page.last_edited_time,
    db: 'converted',
    name: getProp(p, 'Name', 'title'),
    status: getProp(p, 'Status', 'multi_select'),
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
  if (!resp.ok) throw new Error(`Notion DB Error: ${resp.status}`);
  const data = await resp.json();
  return data.results.map(mapper);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body;

  try {
    if (action === 'load') {
      const [leads, converted] = await Promise.all([
        queryDB(LEAD_DB, mapLead),
        queryDB(CONV_DB, mapConverted),
      ]);
      return res.status(200).json({ leads, converted });
    }
    // ... other actions (update/create) stay here ...
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('[crm]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
