export interface CostItem {
  id: string
  name: string
  cost: number // IDR
}

export interface ProductTemplate {
  id: string
  name: string
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

// Extra service object stored in offer.js extraServices array
export interface PeExtraService {
  id: number
  serviceId: string
  label: string
  unit: 'per person'
  pricingEngine: true
  templateId: string
  pax: number
  spppIdr: number // Selling Price Per Person in IDR
  qty: 1
  unitUsd: number // total USD (spppIdr * pax / idrRate), for offer rendering
}
