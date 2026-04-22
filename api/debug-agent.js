// api/debug-agent.js
// MAPE-K: Monitor (error arrives) → Analyze (pattern gate) → Plan (Claude fix) → Execute (push + circuit break)

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const GITHUB_API     = 'https://api.github.com';
const REPO           = 'ubuntubaliyoga/Ubuntu';
const BRANCH         = 'main';

// Pattern gate: Notion error codes we trust Claude to fix automatically
const SAFE_NOTION_CODES = new Set(['object_not_found', 'validation_error', 'invalid_request_url']);

// Only these server files are patchable — maps /api/<route> → file path in repo
const PATCHABLE = {
  'notion':        'api/notion.js',
  'crm':           'api/crm.js',
  'exchange-rate': 'api/exchange-rate.js',
};

// In-memory circuit breaker — resets on cold start (acceptable for lean v1)
const _attempts = new Map();

function fingerprint(err) {
  return `${err.notion_code || ''}|${err.url || ''}|${String(err.message || '').slice(0, 80)}`;
}

function isSafe(err) {
  if (err.type !== 'api') return false;
  if (!SAFE_NOTION_CODES.has(err.notion_code)) return false;
  const route = String(err.url || '').split('?')[0];
  return Boolean(PATCHABLE[route]);
}

async function getFile(filePath) {
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${filePath}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!r.ok) throw new Error(`GitHub read ${filePath}: ${r.status}`);
  const d = await r.json();
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function pushFile(filePath, content, sha, message) {
  const r = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch: BRANCH,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub push ${filePath}: ${r.status} ${t}`);
  }
  return r.json();
}

async function askClaude(error, fileContent, filePath) {
  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const error = req.body || {};
  console.log('[debug-agent] in:', error.type, error.notion_code, error.url);

  // ── ANALYZE ──────────────────────────────────────────────────────────────────
  if (!isSafe(error)) {
    return res.status(200).json({ action: 'skipped', reason: 'outside safe pattern set' });
  }

  const fp  = fingerprint(error);
  const att = _attempts.get(fp) || 0;

  // Circuit breaker (Nygard "Release It!" pattern — open after 2 failures)
  if (att >= 2) {
    console.warn('[debug-agent] circuit open for', fp);
    return res.status(200).json({ action: 'circuit_open', fingerprint: fp, attempts: att });
  }

  const route    = String(error.url).split('?')[0];
  const filePath = PATCHABLE[route];

  try {
    // ── PLAN ─────────────────────────────────────────────────────────────────
    const { content: original, sha } = await getFile(filePath);
    const fix = await askClaude(error, original, filePath);

    if (fix === 'SKIP' || fix === original.trim()) {
      _attempts.set(fp, att + 1);
      return res.status(200).json({ action: 'no_fix', attempts: att + 1, reason: fix === 'SKIP' ? 'claude skipped' : 'no change' });
    }

    // ── EXECUTE ───────────────────────────────────────────────────────────────
    const commitMsg =
      `fix(auto): ${error.notion_code} in ${filePath}\n\n` +
      `Error: ${error.message}\n` +
      `Route: /api/${route}\n` +
      `Auto-fixed by debug-agent (attempt ${att + 1})`;

    await pushFile(filePath, fix, sha, commitMsg);
    _attempts.delete(fp);

    console.log('[debug-agent] pushed fix to', filePath);
    return res.status(200).json({ action: 'fixed', file: filePath, attempts: att + 1 });

  } catch (err) {
    _attempts.set(fp, att + 1);
    console.error('[debug-agent] failed:', err.message);
    return res.status(500).json({ error: err.message, attempts: att + 1 });
  }
}
