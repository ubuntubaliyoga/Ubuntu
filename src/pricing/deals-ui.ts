import type { PricingData } from './types'
import { loadPricingData } from './store'
import { buildLibraryMap, calculateSPPP } from './engine'

// ── Populate the extras picker dropdown ───────────────────────────────────────

export function initDealsUI(data: PricingData): void {
  populateExperiencesPicker(data)
  window.addEventListener('pricingDataUpdated', (e: Event) => {
    populateExperiencesPicker((e as CustomEvent<PricingData>).detail)
  })
}

function populateExperiencesPicker(data: PricingData): void {
  const picker = document.getElementById('extras-picker')
  if (!picker) return

  // Remove any previously injected group
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

// ── Recalculate a pricing-engine extra (called from offer.js and onchange) ───

export async function recalculatePeExtra(id: number, pax: number): Promise<void> {
  pax = Math.max(1, Math.floor(pax))

  const extras = (window as any).extraServices as any[] | undefined
  const item = extras?.find((s: any) => s.id === id)
  if (!item?.pricingEngine || !item.templateId) return

  try {
    const data = await loadPricingData()
    const template = data.templates.find(t => t.id === item.templateId)
    if (!template) return

    const result = calculateSPPP(template, buildLibraryMap(data.library), pax)
    item.pax = pax
    item.spppIdr = result.sellingPrice
    item.unitUsd = getIdrRate() > 0 ? (result.sellingPrice * pax) / getIdrRate() : 0

    if (typeof (window as any).renderExtraServices === 'function') {
      ;(window as any).renderExtraServices()
    }
    if (typeof (window as any).markDraftActive === 'function') {
      ;(window as any).markDraftActive()
    }
  } catch (e) {
    console.error('[PricingEngine] recalculate failed:', e)
  }
}

// ── Expose synchronous SPPP lookup for use by offer.js ───────────────────────

export function getSpppSync(templateId: string, pax: number): number {
  const data = (window as any)._pricingData as PricingData | undefined
  if (!data) return 0
  const template = data.templates.find(t => t.id === templateId)
  if (!template) return 0
  return calculateSPPP(template, buildLibraryMap(data.library), pax).sellingPrice
}

function getIdrRate(): number {
  const el = document.getElementById('f-idrrate') as HTMLInputElement | null
  return parseFloat(el?.value ?? '') || 17085
}
