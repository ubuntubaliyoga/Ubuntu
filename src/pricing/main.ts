import { loadPricingData } from './store'
import {
  openAdmin, closeAdmin, switchPeTab, savePricingAdmin,
  addPeLibraryRow, removePeLibraryRow, addPeTemplate, removePeTemplate,
  peAddCostItem
} from './admin-ui'
import { initDealsUI, recalculatePeExtra } from './deals-ui'
import { sendPeChat, applyPeAction, dismissPeAction } from './chat-ui'

window.openPricingAdmin      = openAdmin
window.closePricingAdmin     = closeAdmin
window.switchPeTab           = switchPeTab
window.savePricingAdmin      = savePricingAdmin
window.addPeLibraryRow       = addPeLibraryRow
window.removePeLibraryRow    = removePeLibraryRow
window.addPeTemplate         = addPeTemplate
window.removePeTemplate      = removePeTemplate
window.peAddCostItem          = peAddCostItem
window.recalculatePeExtra    = recalculatePeExtra
window.sendPeChat            = sendPeChat
window.applyPeAction         = applyPeAction
window.dismissPeAction       = dismissPeAction

async function init(): Promise<void> {
  try {
    const data = await loadPricingData()
    window._pricingData = data
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
