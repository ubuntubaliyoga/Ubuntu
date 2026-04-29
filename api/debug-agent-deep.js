// api/debug-agent-deep.js
// Level 2 agent: Claude Sonnet with live tool use — handles circuit-broken errors
// and JS runtime failures the Level 1 pattern-gate agent cannot reach.
//
// Literature basis:
//   MAPE-K (IBM, 2003): Monitor→Analyze→Plan→Execute loop
//   Xia et al. (2023): tool-augmented LLM repair agents outperform static patch search
//   Nygard "Release It!" (2018): circuit breaker + confidence-gated auto-merge

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const GITHUB_API    = 'https://api.github.com';
const NOTION_API    = 'https://api.notion.com/v1';
const REPO          = 'ubuntubaliyoga/Ubuntu';
const BRANCH        = 'main';

// Files the deep agent may read and patch
const PATCHABLE = new Set([
  'api/notion.js', 'api/crm.js', 'api/exchange-rate.js',
  'api/leadgen-agent.js', 'api/save-pricing.js', 'api/pricing-chat.js',
  'js/core.js', 'js/drafts.js', 'js/offer.js', 'js/crm.js', 'js/bizdev.js',
]);

const notionHdrs = {
  Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type':   'application/json',
};
const ghHdrs = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept:        'application/vnd.github.v3+json',
};

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolReadFile(path, shas) {
  if (!PATCHABLE.has(path)) return { error: `${path} is not in the patchable set` };
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, { headers: ghHdrs });
  if (!r.ok) return { error: `GitHub read ${path}: ${r.status}` };
  const d = await r.json();
  const content = Buffer.from(d.content, 'base64').toString('utf8');
  shas.set(path, d.sha);
  return { content };
}

async function toolListDatabases() {
  const r = await fetch(`${NOTION_API}/search`, {
    method: 'POST', headers: notionHdrs,
    body: JSON.stringify({ filter: { property: 'object', value: 'database' }, page_size: 50 }),
  });
  if (!r.ok) return { error: `Notion search: ${r.status}` };
  const d = await r.json();
  return { databases: d.results.map(db => ({ id: db.id, title: db.title?.[0]?.plain_text || '(untitled)' })) };
}

async function toolGetSchema(databaseId) {
  const r = await fetch(`${NOTION_API}/databases/${databaseId}`, { headers: notionHdrs });
  if (!r.ok) return { error: `Notion schema ${databaseId}: ${r.status}` };
  const d = await r.json();
  return {
    id:         d.id,
    title:      d.title?.[0]?.plain_text || '(untitled)',
    properties: Object.entries(d.properties).map(([name, p]) => ({ name, type: p.type })),
  };
}

async function ghPush(filePath, content, sha, message, branch = BRANCH) {
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: { ...ghHdrs, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha, branch }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`GitHub push: ${r.status} ${t}`); }
  return r.json();
}

async function createPR(filePath, content, sha, error) {
  const ref = await fetch(`${GITHUB_API}/repos/${REPO}/git/ref/heads/${BRANCH}`, { headers: ghHdrs });
  if (!ref.ok) throw new Error(`GitHub ref: ${ref.status}`);
  const { object: { sha: mainSha } } = await ref.json();

  const prBranch = `debug-agent/${Date.now()}`;
  const bRef = await fetch(`${GITHUB_API}/repos/${REPO}/git/refs`, {
    method: 'POST',
    headers: { ...ghHdrs, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: mainSha }),
  });
  if (!bRef.ok) throw new Error(`Branch create: ${bRef.status}`);

  await ghPush(filePath, content, sha, `fix(agent): proposed fix in ${filePath}`, prBranch);

  const pr = await fetch(`${GITHUB_API}/repos/${REPO}/pulls`, {
    method: 'POST',
    headers: { ...ghHdrs, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[debug-agent] ${error.notion_code || error.type} in ${filePath}`,
      body:  `Proposed by deep debug agent — below auto-merge confidence threshold.\n\n**Error:**\n\`\`\`json\n${JSON.stringify(error, null, 2)}\n\`\`\``,
      head:  prBranch,
      base:  BRANCH,
    }),
  });
  if (!pr.ok) throw new Error(`PR create: ${pr.status}`);
  return (await pr.json()).html_url;
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'read_file',
    description: 'Read a source file from the repository. Always call this before apply_fix.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Repo-relative path, e.g. api/notion.js or js/drafts.js' } },
      required: ['path'],
    },
  },
  {
    name: 'list_notion_databases',
    description: 'List all Notion databases the integration can access (id + title). Use when object_not_found suggests a wrong DB ID constant.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_notion_schema',
    description: 'Get property names and types for a Notion database. Use when validation_error suggests a wrong property name.',
    input_schema: {
      type: 'object',
      properties: { database_id: { type: 'string' } },
      required: ['database_id'],
    },
  },
  {
    name: 'apply_fix',
    description: 'Push the complete corrected file. Must have called read_file first. Use auto_merge only for single-constant or single-property-name changes.',
    input_schema: {
      type: 'object',
      properties: {
        path:       { type: 'string' },
        content:    { type: 'string', description: 'Complete corrected file content' },
        confidence: { type: 'string', enum: ['auto_merge', 'needs_review'] },
      },
      required: ['path', 'content', 'confidence'],
    },
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const error = req.body || {};
  console.log('[debug-agent-deep] in:', error.type, error.notion_code || '', error.message);

  const shas = new Map();

  const messages = [{
    role: 'user',
    content: `You are a deep bug-fix agent for a Notion-backed Node.js PWA on Vercel. Use the tools to diagnose and fix the error.

Error:
${JSON.stringify(error, null, 2)}

Strategy by error type:
- object_not_found  → call list_notion_databases() to get real UUIDs, then read_file and correct the constant
- validation_error  → call get_notion_schema(db_id) for the relevant database, then read_file and fix the mismatched property name or type
- API error (no notion_code, status 500) → read_file for the route in error.url (prefix api/), find the JS crash (TypeError, undefined, etc.), apply minimal fix
- JS / promise      → read_file for the file named in the stack trace (prefix js/ for client files), identify the root cause, apply minimal fix
Always read_file before apply_fix. Use auto_merge only when the change is a single constant, property name, or null-safety guard.`,
  }];

  let applyCall = null;

  for (let turn = 0; turn < 8 && !applyCall; turn++) {
    const r = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8096, tools: TOOLS, messages }),
    });

    if (!r.ok) return res.status(500).json({ error: `Anthropic: ${r.status}` });
    const response = await r.json();
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') break;

    const results = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let result;
      if      (block.name === 'read_file')            result = await toolReadFile(block.input.path, shas);
      else if (block.name === 'list_notion_databases') result = await toolListDatabases();
      else if (block.name === 'get_notion_schema')     result = await toolGetSchema(block.input.database_id);
      else if (block.name === 'apply_fix')             { applyCall = block.input; result = { acknowledged: true }; }
      else                                              result = { error: 'unknown tool' };
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: results });
  }

  if (!applyCall) return res.status(200).json({ action: 'no_fix', reason: 'agent did not call apply_fix' });

  const { path: filePath, content: fixed, confidence } = applyCall;
  const sha = shas.get(filePath);
  if (!sha) return res.status(500).json({ error: `read_file was not called for ${filePath}` });

  try {
    if (confidence === 'auto_merge') {
      await ghPush(filePath, fixed, sha,
        `fix(deep-agent): ${error.notion_code || error.type} in ${filePath}\n\nAuto-fixed by deep debug agent`);
      return res.status(200).json({ action: 'fixed', file: filePath, confidence: 'auto_merge' });
    } else {
      const prUrl = await createPR(filePath, fixed, sha, error);
      return res.status(200).json({ action: 'pr_created', file: filePath, pr: prUrl });
    }
  } catch (err) {
    console.error('[debug-agent-deep] push/PR failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
