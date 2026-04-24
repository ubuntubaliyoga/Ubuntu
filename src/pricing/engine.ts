import type { CostItem, ProductTemplate, PricingResult } from './types'

export function buildLibraryMap(library: CostItem[]): Map<string, CostItem> {
  return new Map(library.map(item => [item.id, item]))
}

/**
 * SPPP = CEIL( (ΣfixedCosts / n + ΣvariableCosts) × markup )
 * Fixed costs are divided by pax; variable costs are per-person constants.
 * Ceiling rounds up to the nearest integer (IDR).
 */
export function calculateSPPP(
  template: ProductTemplate,
  library: Map<string, CostItem>,
  pax: number
): PricingResult {
  const fixedTotal = template.fixed_cost_refs
    .reduce((sum, id) => sum + (library.get(id)?.cost ?? 0), 0)

  const variableTotal = template.variable_cost_refs
    .reduce((sum, id) => sum + (library.get(id)?.cost ?? 0), 0)

  const costPerPerson = fixedTotal / pax + variableTotal
  const sellingPrice = Math.ceil(costPerPerson * template.markup)

  return { fixedTotal, variableTotal, costPerPerson, sellingPrice }
}
