import { loadPricingData } from './store'
import { initAdminUI, openAdmin, closeAdmin, switchPeTab, savePricingAdmin, addPeLibraryRow, removePeLibraryRow, addPeTemplate, removePeTemplate, enforceMutualExclusion } from './admin-ui'
import { initDealsUI, recalculatePeExtra, getSpppSync } from './deals-ui'

// Expose all functions needed by HTML onclick handlers
;(window as any).openPricingAdmin = openAdmin
;(window as any).closePricingAdmin = closeAdmin
;(window as any).switchPeTab = switchPeTab
;(window as any).savePricingAdmin = savePricingAdmin
;(window as any).addPeLibraryRow = addPeLibraryRow
;(window as any).removePeLibraryRow = removePeLibraryRow
;(window as any).addPeTemplate = addPeTemplate
;(window as any).removePeTemplate = removePeTemplate
;(window as any).enforceMutualExclusion = enforceMutualExclusion
;(window as any).recalculatePeExtra = recalculatePeExtra

// Synchronous SPPP lookup for offer.js addExtraService
;(window as any).getSpppSync = getSpppSync

async function init(): Promise<void> {
  try {
    const data = await loadPricingData()
    ;(window as any)._pricingData = data
    initAdminUI(data)
    initDealsUI(data)
  } catch (e) {
    console.error('[PricingEngine] Failed to load pricing data:', e)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
