// api/crm.js
export default async function handler(req, res) {
  // Always return JSON to prevent "Unexpected Token A"
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;
  const LEAD_DB = '8e5622d3e57482ba950081ac7695672e';
  const CONV_DB = '325622d3e57481bbbaaedeb47e377f2c';

  try {
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({ error: 'NOTION_TOKEN missing in Vercel' });
    }

    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    if (action === 'load') {
      const fetchDB = async (id) => {
        const r = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ page_size: 100 })
        });
        if (!r.ok) throw new Error(`Notion error: ${r.status}`);
        return r.json();
      };

      const [leadsData, convData] = await Promise.all([fetchDB(LEAD_DB), fetchDB(CONV_DB)]);

      const leads = (leadsData.results || []).map(p => ({
        id: p.id,
        name: p.properties.Name?.title?.[0]?.plain_text || 'Unnamed',
        company: p.properties.Company?.rich_text?.[0]?.plain_text || '',
        status: p.properties.Instagram?.select?.name || 'New'
      }));

      return res.status(200).json({ leads, convertedCount: convData.results?.length || 0 });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('CRM API Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
