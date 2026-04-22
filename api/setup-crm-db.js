// api/setup-crm-db.js — ONE-TIME: creates the unified CRM database in Notion
// GET  /api/setup-crm-db  → creates the DB and returns its ID
// Delete this file after use.

const NOTION_API = 'https://api.notion.com/v1';
const OLD_EMAIL_DB = '8e5622d3e57482ba950081ac7695672e'; // source of truth for parent page

const hdrs = {
  Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type':   'application/json',
};

export default async function handler(req, res) {
  if (!process.env.NOTION_TOKEN) return res.status(500).json({ error: 'NOTION_TOKEN not set' });

  try {
    // 1. Find where the old CRM databases live
    const oldR = await fetch(`${NOTION_API}/databases/${OLD_EMAIL_DB}`, { headers: hdrs });
    if (!oldR.ok) {
      const t = await oldR.json();
      return res.status(500).json({ error: 'Could not read old email DB', detail: t.message });
    }
    const oldDb = await oldR.json();
    const parent = oldDb.parent; // preserve type (page_id or workspace)

    // 2. Create unified CRM database
    const schema = {
      'Name':                         { title: {} },
      'Source':                       { select: { options: [
        { name: 'Email',    color: 'blue'   },
        { name: 'WhatsApp', color: 'green'  },
        { name: 'Shala',    color: 'orange' },
      ]}},
      'Converted':                    { checkbox: {} },
      'Company':                      { rich_text: {} },
      'Email':                        { email: {} },
      'LinkedIn':                     { rich_text: {} },
      'Location':                     { rich_text: {} },
      'Insta':                        { rich_text: {} },
      'Website':                      { rich_text: {} },
      'Whatsapp':                     { rich_text: {} },
      'Whatsapp 2':                   { rich_text: {} },
      'Notes':                        { rich_text: {} },
      'Contact':                      { rich_text: {} },
      'Status':                       { select: { options: [
        { name: 'Followed + Engaged',                        color: 'default' },
        { name: 'Booked a call',                             color: 'yellow'  },
        { name: 'Sent an offer',                             color: 'blue'    },
        { name: 'QUALIFIED TO BUY',                          color: 'purple'  },
        { name: 'WARM: Booked a call OR asked for help',     color: 'orange'  },
        { name: 'HOT: Past client/strong conversation',      color: 'red'     },
        { name: 'SALE CLOSED',                               color: 'green'   },
        { name: 'Converted to Customer',                     color: 'green'   },
        { name: 'GHOSTED',                                   color: 'gray'    },
        { name: 'TERMINATED',                                color: 'gray'    },
        { name: 'NOT GOOD FIT',                              color: 'gray'    },
      ]}},
      'Suitability':                  { select: {} },
      'Reached out on':               { multi_select: { options: [
        { name: 'Email',       color: 'blue'   },
        { name: 'Instagram',   color: 'pink'   },
        { name: 'LinkedIn',    color: 'blue'   },
        { name: 'WhatsApp',    color: 'green'  },
        { name: 'In Person',   color: 'yellow' },
        { name: 'Cold Call',   color: 'orange' },
      ]}},
      'Engaged first':                { date: {} },
      'Engaged last':                 { date: {} },
      'Engage Next':                  { date: {} },
      'Sales Call/Visit Booked Date': { date: {} },
    };

    const createR = await fetch(`${NOTION_API}/databases`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        parent,
        title: [{ text: { content: 'CRM' } }],
        properties: schema,
      }),
    });

    if (!createR.ok) {
      const t = await createR.json();
      return res.status(500).json({ error: 'Failed to create database', detail: t.message, parent });
    }

    const created = await createR.json();
    return res.status(200).json({
      ok:     true,
      db_id:  created.id,
      url:    created.url,
      parent: created.parent,
      note:   'Copy db_id into api/crm.js, api/migrate-crm.js, api/drift-detector.js — then delete this file.',
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
