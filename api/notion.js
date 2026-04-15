// api/notion.js
// Saves a NEW retreat offer/contract entry to the Contracts Retreat Leaders database.

const DB_ID = '978a217d69ae41bf9ca7ba9f5737ca3c';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      organizer,
      retreatName,
      checkin,
      checkout,
      contractDate,
      rooms,
      nights,
      guests,
      totalUSD,
      status,
      formState,
    } = req.body;

    const properties = {
      'Organizer':    { title:     [{ text: { content: organizer    || '' } }] },
      'Retreat Name': { rich_text: [{ text: { content: retreatName  || '' } }] },
      'Form State':   { rich_text: [{ text: { content: formState    || '' } }] },
      'Rooms':        { number: rooms     ? Number(rooms)    : null },
      'Nights':       { number: nights    ? Number(nights)   : null },
      'Guests':       { number: guests    ? Number(guests)   : null },
      'Total USD':    { number: totalUSD  ? Number(totalUSD) : null },
      'Status':       { select: { name: status || 'Draft' } },
      ...(checkin      && { 'Check-in':      { date: { start: checkin } } }),
      ...(checkout     && { 'Check-out':     { date: { start: checkout } } }),
      ...(contractDate && { 'Contract Date': { date: { start: contractDate } } }),
    };

    const resp = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: DB_ID },
        properties,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    return res.status(200).json({ success: true, pageId: data.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
