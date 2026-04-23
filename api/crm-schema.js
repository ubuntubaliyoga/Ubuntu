// api/crm-schema.js — one-shot diagnostic: returns live Notion CRM property names + types
export default async function handler(req, res) {
  const r = await fetch('https://api.notion.com/v1/databases/34a622d3e57481738b3ce70824a6adf7', {
    headers: {
      Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
  });
  const d = await r.json();
  const schema = Object.fromEntries(
    Object.entries(d.properties || {}).map(([name, p]) => [name, p.type])
  );
  res.json({ schema });
}
