// api/crm.js
const LEAD_DB = '8e5622d3e57482ba950081ac7695672e';
const CONV_DB = '325622d3e57481bbbaaedeb47e377f2c';

export default async function handler(req, res) {
  // Ensure we always return JSON to avoid the "Unexpected Token A" error
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    // Check for the secret token
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({ error: "Missing NOTION_TOKEN in Vercel settings." });
    }

    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    if (action === 'load') {
      // Fetch both databases
      const [leadsRes, convRes] = await Promise.all([
        fetch(`https://api.notion.com/v1/databases/${LEAD_DB}/query`, { 
          method: 'POST', headers, body: JSON.stringify({ page_size: 100 }) 
        }),
        fetch(`https://api.notion.com/v1/databases/${CONV_DB}/query`, { 
          method: 'POST', headers, body: JSON.stringify({ page_size: 100 }) 
        })
      ]);

      if (!leadsRes.ok || !convRes.ok) {
        throw new Error(`Notion API returned error: ${leadsRes.status}`);
      }

      const leadsData = await leadsRes.json();
      const convData = await convRes.json();

      // Safe mapping logic
      const leads = (leadsData.results || []).map(page => ({
        id: page.id,
        name: page.properties.Name?.title?.[0]?.plain_text || 'Unnamed Lead',
        company: page.properties.Company?.rich_text?.[0]?.plain_text || '',
        status: page.properties.Instagram?.select?.name || 'New'
      }));

      return res.status(200).json({ leads, convertedCount: convData.results?.length || 0 });
    }

    return res.status(400).json({ error: `Action ${action} not supported` });

  } catch (err) {
    console.error('[API ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
