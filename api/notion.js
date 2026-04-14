export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  const { contractData } = req.body;

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      parent: { database_id: DATABASE_ID },
      properties: {
        'Organizer': { title: [{ text: { content: contractData.organizerCompany || '' } }] },
        'Retreat Name': { rich_text: [{ text: { content: contractData.retreatName || '' } }] },
        'Contract Date': { date: { start: contractData.contractDate || null } },
        'Check-in': { date: { start: contractData.checkinDate || null } },
        'Check-out': { date: { start: contractData.checkoutDate || null } },
        'Rooms': { number: parseInt(contractData.rooms) || 0 },
        'Guests': { number: parseInt(contractData.guests) || 0 },
        'Total USD': { number: parseFloat(contractData.total) || 0 },
        'Status': { select: { name: 'Draft' } }
      }
    })
  });

  const data = await response.json();
  res.status(200).json(data);
}
