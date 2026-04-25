const OWNER = 'ubuntubaliyoga'
const REPO  = 'Ubuntu'
const PATH  = 'data/pricing.json'
const BRANCH = 'main'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { library, templates } = req.body || {}
  if (!Array.isArray(library) || !Array.isArray(templates)) {
    return res.status(400).json({ error: 'Invalid payload: library and templates required' })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' })

  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ubuntu-flow-pricing'
  }

  // Fetch current SHA (required for update)
  const getRes = await fetch(apiBase, { headers })
  let sha
  if (getRes.ok) {
    const current = await getRes.json()
    sha = current.sha
  } else if (getRes.status !== 404) {
    return res.status(502).json({ error: 'GitHub API error fetching current file' })
  }

  const content = Buffer.from(
    JSON.stringify({ library, templates }, null, 2) + '\n'
  ).toString('base64')

  const body = {
    message: 'chore: update pricing data via admin UI',
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {})
  }

  const putRes = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}))
    return res.status(502).json({ error: err.message || 'GitHub write failed' })
  }

  return res.status(200).json({ ok: true })
}
