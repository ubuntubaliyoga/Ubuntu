// api/clear-reached-out.js
// One-shot: clear "Reached out on" for all leads created since yesterday.
// GET /api/clear-reached-out?dry=1  → report only, no writes
// GET /api/clear-reached-out        → update Notion

export const config = { maxDuration: 60 };

const CRM_DB_ID  = '34a622d3e57481738b3ce70824a6adf7';
const NOTION_VER = '2022-06-28';

export default async function handler(req, res) {
  const dry = req.query?.dry === '1';

  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const since = yesterday.toISOString().slice(0, 10);

  const leads = await fetchLeadsSince(since);
  const toUpdate = leads.filter(l => l.reachedOutOn.length > 0);

  if (!dry) {
    await Promise.all(toUpdate.map(l =>
      fetch(`https://api.notion.com/v1/pages/${l.pageId}`, {
        method: 'PATCH',
        headers: notionHeaders(),
        body: JSON.stringify({ properties: { 'Reached out on': { multi_select: [] } } }),
      })
    ));
  }

  res.json({
    since,
    total: leads.length,
    cleared: toUpdate.length,
    dry,
    rows: leads.map(l => ({
      name: l.name,
      engagedFirst: l.engagedFirst,
      hadChannels: l.reachedOutOn,
      cleared: !dry && toUpdate.includes(l),
    })),
  });
}

async function fetchLeadsSince(since) {
  const leads = [];
  let cursor;
  do {
    const body = {
      filter: { property: 'Engaged first', date: { on_or_after: since } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const r = await fetch(`https://api.notion.com/v1/databases/${CRM_DB_ID}/query`, {
      method: 'POST', headers: notionHeaders(), body: JSON.stringify(body),
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

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VER,
  };
}
