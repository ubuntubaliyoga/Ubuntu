import type { PricingData } from './types'
import { loadPricingData } from './store'
import { buildLibraryMap, calculateSPPP } from './engine'

export function initDealsUI(data: PricingData): void {
  populateExperiencesPicker(data)
  window.addEventListener('pricingDataUpdated', (e: Event) => {
    populateExperiencesPicker((e as CustomEvent<PricingData>).detail)
  })
}

function populateExperiencesPicker(data: PricingData): void {
  const picker = document.getElementById('extras-picker')
  if (!picker) return
  picker.querySelector('optgroup[label="Experiences"]')?.remove()
  if (!data.templates.length) return

  const group = document.createElement('optgroup')
  group.label = 'Experiences'
  data.templates.forEach(t => {
    const opt = document.createElement('option')
    opt.value = `pe_${t.id}|${t.name}`
    opt.textContent = `🧭 ${t.name}`
    group.appendChild(opt)
  })
  picker.appendChild(group)
}

// Experiences are costed entirely from the IDR cost library (see engine.ts) — there's
// no exchange rate in the app, so these items are priced natively in IDR only.
export async function recalculatePeExtra(id: number, pax: number): Promise<void> {
  pax = Math.max(1, Math.floor(pax))
  const item = window.extraServices?.find(s => s.id === id)
  if (!item?.pricingEngine || !item.templateId) return

  try {
    const data = await loadPricingData()
    const template = data.templates.find(t => t.id === item.templateId)
    if (!template) return

    const { sellingPrice } = calculateSPPP(template, buildLibraryMap(data.library), pax)
    item.pax = pax
    item.spppIdr = sellingPrice

    window.renderExtraServices?.()
    window.markDraftActive?.()
  } catch (e) {
    console.error('[PricingEngine] recalculate failed:', e)
  }
}
