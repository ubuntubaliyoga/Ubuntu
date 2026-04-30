export interface CostItem {
  id: string
  name: string
  cost: number // IDR
}

export interface ProductTemplate {
  id: string
  name: string
  type?: 'experience' | 'service'
  fixed_cost_refs: string[]
  variable_cost_refs: string[]
  markup: number
}

export interface PricingData {
  library: CostItem[]
  templates: ProductTemplate[]
}

export interface PricingResult {
  fixedTotal: number
  variableTotal: number
  costPerPerson: number
  sellingPrice: number // IDR, after markup + Math.ceil
}

export interface PeExtraService {
  id: number
  serviceId: string
  label: string
  unit: 'per person'
  pricingEngine: true
  templateId: string
  pax: number
  spppIdr: number
  qty: 1
  unitUsd: number
}

declare global {
  interface Window {
    openPricingAdmin(): void
    closePricingAdmin(): void
    switchPeTab(tab: 'library' | 'experiences' | 'services'): void
    savePricingAdmin(): void
    triggerPeAutosave(): void
    addPeLibraryRow(): void
    removePeLibraryRow(btn: HTMLElement): void
    addPeTemplate(): void
    removePeTemplate(btn: HTMLElement): void
    recalculatePeExtra(id: number, pax: number): Promise<void>
    peAddCostItem(sel: HTMLSelectElement): void
    sendPeChat(): void
    applyPeAction(id: string): void
    dismissPeAction(id: string): void
    _pricingData?: PricingData
    extraServices?: PeExtraService[]
    renderExtraServices?(): void
    markDraftActive?(): void
  }
}
