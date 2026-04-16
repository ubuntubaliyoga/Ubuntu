const LEAD_DB = '8e5622d3e57482ba950081ac7695672e';
const CONV_DB = '325622d3e57481bbbaaedeb47e377f2c';

export default async function handler(req, res) {
  // Set headers so the browser always sees JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.body;

  try {
    if (!process.env.NOTION_TOKEN) {
      throw new Error("NOTION_TOKEN is missing in Vercel environment variables.");
    }

    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    if (action === 'load') {
      const fetchDB = async (dbId) => {
        const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST', headers, body: JSON.stringify({ page_size: 100 })
        });
        if (!r.ok) throw new Error(`Notion DB ${dbId} failed: ${r.status}`);
        return await r.json();
      };

      const [leadsData, convData] = await Promise.all([fetchDB(LEAD_DB), fetchDB(CONV_DB)]);
      
      // Minimal mapper for brevity
      const leads = leadsData.results.map(p => ({
        id: p.id,
        name: p.properties.Name?.title[0]?.plain_text || 'Unnamed',
        status: p.properties.Instagram?.select?.name || 'New'
      }));

      return res.status(200).json({ leads, converted: convData.results.length });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    // Explicitly returning JSON so the frontend doesn't see "Unexpected Token A"
    return res.status(500).json({ error: err.message });
  }
}
