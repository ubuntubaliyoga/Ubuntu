// api/drift-detector.js
// Called daily by Vercel cron and on app startup.
// Compares live Notion property schemas against names hardcoded in
// api/notion.js and api/crm.js — catches drift before it becomes a
// runtime validation_error or object_not_found.

const NOTION_API = 'https://api.notion.com/v1';

const hdrs = {
  Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
};

// Mirrors exactly what each API file reads/writes.
// Update here whenever you rename a property in the code.
const EXPECTED = [
  {
    id:     '978a217d69ae41bf9ca7ba9f5737ca3c',
    label:  'Offers DB',
    source: 'api/notion.js',
    props: {
      'Organizer':     'title',
      'Retreat Name':  'rich_text',
      'Form State':    'rich_text',
      'Rooms':         'number',
      'Nights':        'number',
      'Guests':        'number',
      'Total USD':     'number',
      'Status':        'select',
      'Check-in':      'date',
      'Check-out':     'date',
      'Contract Date': 'date',
    },
  },
  {
    id:     'REPLACE_WITH_NEW_DB_ID',
    label:  'CRM DB (unified)',
    source: 'api/crm.js',
    props: {
      'Name':                         'title',
      'Source':                       'select',
      'Converted':                    'checkbox',
      'Company':                      'rich_text',
      'Email':                        'email',
      'LinkedIn':                     'rich_text',
      'Location':                     'rich_text',
      'Insta':                        'rich_text',
      'Website':                      'rich_text',
      'Whatsapp':                     'rich_text',
      'Whatsapp 2':                   'rich_text',
      'Notes':                        'rich_text',
      'Contact':                      'rich_text',
      'Status':                       'select',
      'Suitability':                  'select',
      'Reached out on':               'multi_select',
      'Engaged first':                'date',
      'Engaged last':                 'date',
      'Engage Next':                  'date',
      'Sales Call/Visit Booked Date': 'date',
    },
  },
];

async function checkDB({ id, label, source, props }) {
  const r = await fetch(`${NOTION_API}/databases/${id}`, { headers: hdrs });
  if (!r.ok) {
    return [{ db: label, source, property: '(database)', issue: `unreachable HTTP ${r.status}` }];
  }
  const schema = (await r.json()).properties || {};
  const drifts = [];
  for (const [name, expectedType] of Object.entries(props)) {
    if (!schema[name]) {
      drifts.push({ db: label, source, property: name, issue: 'missing' });
    } else if (schema[name].type !== expectedType) {
      drifts.push({ db: label, source, property: name,
        issue: `type changed: expected ${expectedType}, got ${schema[name].type}` });
    }
  }
  return drifts;
}

export default async function handler(req, res) {
  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN not set' });
  }

  const results  = await Promise.all(EXPECTED.map(checkDB));
  const drifts   = results.flat();
  const checkedAt = new Date().toISOString();

  if (drifts.length > 0) {
    console.warn('[drift-detector] DRIFT:', JSON.stringify(drifts));
  } else {
    console.log(`[drift-detector] all OK — ${EXPECTED.length} databases checked at ${checkedAt}`);
  }

  return res.status(200).json({ ok: drifts.length === 0, checked: EXPECTED.length, drifts, checkedAt });
}
