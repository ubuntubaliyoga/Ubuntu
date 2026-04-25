// api/debug-agent.js — two-level auto-fix agent
// POST { ...error }         → Level 1: Haiku pattern-gate (was api/debug-agent.js)
// POST { level:2, ...error} → Level 2: Sonnet tool-use   (was api/debug-agent-deep.js)

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const GITHUB_API    = 'https://api.github.com';
const NOTION_API    = 'https://api.notion.com/v1';
const REPO          = 'ubuntubaliyoga/Ubuntu';
const BRANCH        = 'main';

// ── LEVEL 1 ───────────────────────────────────────────────────────────────────

const SAFE_NOTION_CODES = new Set(['object_not_found', 'validation_error', 'invalid_request_url']);

const L1_PATCHABLE = {
  'data': 'api/data.js',
};

const _attempts = new Map();

function fingerprint(err) {
  return `${err.notion_code || ''}|${err.url || ''}|${String(err.message || '').slice(0, 80)}`;
}

function isSafe(err) {
  if (err.type !== 'api') return false;
  if (!SAFE_NOTION_CODES.has(err.notion_code)) return false;
  const route = String(err.url || '').split('?')[0];
  return Boolean(L1_PATCHABLE[route]);
}

async function getFile(filePath) {
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${filePath}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!r.ok) throw new Error(`GitHub read ${filePath}: ${r.status}`);
  const d = await r.json();
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function pushFile(filePath, content, sha, message) {
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha, branch: BRANCH }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`GitHub push ${filePath}: ${r.status} ${t}`); }
  return r.json();
}

async function askClaude(error, fileContent, filePath) {
  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are an automated patch agent for a Notion-backed PWA on Vercel. \
Apply the minimal one-line fix to resolve the error below. \
Return ONLY the complete corrected file — no explanation, no markdown fences, nothing else.

ERROR (structured):
${JSON.stringify(error, null, 2)}

FILE: ${filePath}
${fileContent}

Rules:
- object_not_found → a Notion DB ID or page ID constant is wrong; correct it to the right UUID
- validation_error  → a property name or its type mapping is wrong; correct the field name or value shape
- invalid_request_url → a hard-coded Notion endpoint URL is malformed; correct the URL
- Change as few characters as possible — surgical fix only
- If you cannot identify the fix with certainty, respond with exactly the four characters: SKIP`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic API: ${r.status}`);
  const d = await r.json();
  return (d.content?.[0]?.text || 'SKIP').trim();
}

async function handleLevel1(error, res) {
  console.log('[debug-agent] L1 in:', error.type, error.notion_code, error.url);

  if (!isSafe(error)) return res.status(200).json({ action: 'skipped', reason: 'outside safe pattern set' });

  const fp  = fingerprint(error);
  const att = _attempts.get(fp) || 0;

  if (att >= 2) {
    console.warn('[debug-agent] circuit open for', fp);
    return res.status(200).json({ action: 'circuit_open', fingerprint: fp, attempts: att });
  }

  const route    = String(error.url).split('?')[0];
  const filePath = L1_PATCHABLE[route];

  try {
    const { content: original, sha } = await getFile(filePath);
    const fix = await askClaude(error, original, filePath);

    if (fix === 'SKIP' || fix === original.trim()) {
      _attempts.set(fp, att + 1);
      return res.status(200).json({ action: 'no_fix', attempts: att + 1, reason: fix === 'SKIP' ? 'claude skipped' : 'no change' });
    }

    const commitMsg =
      `fix(auto): ${error.notion_code} in ${filePath}\n\n` +
      `Error: ${error.message}\n` +
      `Route: /api/${route}\n` +
      `Auto-fixed by debug-agent (attempt ${att + 1})`;

    await pushFile(filePath, fix, sha, commitMsg);
    _attempts.delete(fp);
    console.log('[debug-agent] L1 pushed fix to', filePath);
    return res.status(200).json({ action: 'fixed', file: filePath, attempts: att + 1 });
  } catch (err) {
    _attempts.set(fp, att + 1);
    console.error('[debug-agent] L1 failed:', err.message);
    return res.status(500).json({ error: err.message, attempts: att + 1 });
  }
}

// ── LEVEL 2 ───────────────────────────────────────────────────────────────────

const L2_PATCHABLE = new Set([
  'api/data.js', 'api/pricing.js', 'api/leadgen-agent.js', 'api/debug-agent.js',
  'js/core.js', 'js/drafts.js', 'js/offer.js', 'js/crm.js',
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

async function toolReadFile(path, shas) {
  if (!L2_PATCHABLE.has(path)) return { error: `${path} is not in the patchable set` };
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

const L2_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a source file from the repository. Always call this before apply_fix.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Repo-relative path, e.g. api/data.js or js/drafts.js' } },
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

async function handleLevel2(error, res) {
  console.log('[debug-agent] L2 in:', error.type, error.notion_code || '', error.message);

  const shas = new Map();
  const messages = [{
    role: 'user',
    content: `You are a deep bug-fix agent for a Notion-backed Node.js PWA on Vercel. Use the tools to diagnose and fix the error.

Error:
${JSON.stringify(error, null, 2)}

Strategy by error type:
- object_not_found  → call list_notion_databases() to get real UUIDs, then read_file and correct the constant
- validation_error  → call get_notion_schema(db_id) for the relevant database, then read_file and fix the mismatched property name or type
- JS / promise      → read_file for the file named in the stack trace (prefix js/ for client files), identify the root cause, apply minimal fix
Always read_file before apply_fix. Use auto_merge only when the change is a single constant, property name, or null-safety guard.`,
  }];

  let applyCall = null;

  for (let turn = 0; turn < 8 && !applyCall; turn++) {
    const r = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8096, tools: L2_TOOLS, messages }),
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
    console.error('[debug-agent] L2 push/PR failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { level, ...error } = req.body || {};
  if (level === 2) return handleLevel2(error, res);
  return handleLevel1(error, res);
}
