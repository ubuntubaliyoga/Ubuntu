const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

const TOOLS = [
  {
    name: 'add_library_item',
    description: 'Add a new cost item to the cost library',
    input_schema: {
      type: 'object',
      properties: {
        id:   { type: 'string', description: 'Unique SCREAMING_SNAKE_CASE ID, e.g. COOKING_GUIDE' },
        name: { type: 'string', description: 'Human-readable name' },
        cost: { type: 'number', description: 'Cost in IDR' }
      },
      required: ['id', 'name', 'cost']
    }
  },
  {
    name: 'create_template',
    description: 'Create a new experience template',
    input_schema: {
      type: 'object',
      properties: {
        id:                  { type: 'string', description: 'Unique SCREAMING_SNAKE_CASE ID' },
        name:                { type: 'string', description: 'Display name shown to users' },
        fixed_cost_refs:     { type: 'array',  items: { type: 'string' }, description: 'Library IDs for shared group costs (e.g. transport)' },
        variable_cost_refs:  { type: 'array',  items: { type: 'string' }, description: 'Library IDs for per-person costs' },
        markup:              { type: 'number', description: 'Price multiplier, e.g. 1.4 for 40% above cost' }
      },
      required: ['id', 'name', 'fixed_cost_refs', 'variable_cost_refs', 'markup']
    }
  },
  {
    name: 'update_cost',
    description: 'Update the IDR cost of an existing library item',
    input_schema: {
      type: 'object',
      properties: {
        id:   { type: 'string', description: 'Library item ID to update' },
        cost: { type: 'number', description: 'New cost in IDR' }
      },
      required: ['id', 'cost']
    }
  }
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, pricingData, history = [] } = req.body || {}
  if (!message || !pricingData) return res.status(400).json({ error: 'message and pricingData required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const system = `You are a pricing assistant for Ubuntu Bali, a yoga retreat hosting venue in Bali, Indonesia.
You help manage the pricing engine for experiences and tours. All costs are in IDR (Indonesian Rupiah).

Current pricing data:
${JSON.stringify(pricingData, null, 2)}

Pricing formula: SPPP = CEIL((fixedCosts ÷ pax + variableCosts) × markup)
- Fixed costs: shared group expenses split equally per person. Currently only transport qualifies — e.g. one car = IDR 300,000 ÷ 5 participants = IDR 60,000 per person.
- Variable costs: per-person expenses regardless of group size (entrance fees, guide, lunch, offerings, etc.)

When the user asks you to add, create, or update something, use a tool. Otherwise respond conversationally.
Be concise. Costs are always IDR.`

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages: [...history, { role: 'user', content: message }]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    return res.status(502).json({ error: err.error?.message || 'Claude API error' })
  }

  const data = await response.json()
  let reply = ''
  let toolCall = null

  for (const block of data.content || []) {
    if (block.type === 'text') reply += block.text
    if (block.type === 'tool_use') toolCall = { name: block.name, input: block.input }
  }

  if (!reply && toolCall) reply = 'Done — review the suggestion below and click Apply.'

  return res.status(200).json({ reply, toolCall })
}
