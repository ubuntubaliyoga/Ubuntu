import type { PricingData } from './types'

let cache: PricingData | null = null

export async function loadPricingData(): Promise<PricingData> {
  if (cache) return cache
  const res = await fetch('/data/pricing.json?t=' + Date.now())
  if (!res.ok) throw new Error(`Failed to load pricing data: ${res.status}`)
  cache = await res.json() as PricingData
  return cache
}

export async function savePricingData(data: PricingData): Promise<void> {
  const res = await fetch('/api/save-pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Save failed')
  }
  cache = data
}
