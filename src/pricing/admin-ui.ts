import type { CostItem, PricingData, ProductTemplate } from './types'
import { savePricingData, loadPricingData } from './store'

let currentData: PricingData | null = null
let currentTab: 'library' | 'experiences' | 'services' = 'library'
let autosaveTimer: any = null

// ── Public API ────────────────────────────────────────────────────────────────

export function openAdmin(): void {
  loadPricingData().then(data => {
    currentData = JSON.parse(JSON.stringify(data))
    renderOverlay()
    document.getElementById('pricing-overlay')?.classList.add('open')
  })
}

export function closeAdmin(): void {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    savePricingAdmin(true) // Final sync on close
  }
  document.getElementById('pricing-overlay')?.classList.remove('open')
}

export function switchPeTab(tab: 'library' | 'experiences' | 'services'): void {
  if (currentData) snapshotTab()
  currentTab = tab
  renderTabContent()
  document.querySelectorAll('.pe-tab').forEach(b => b.classList.remove('active'))
  document.getElementById(`pe-tab-${tab}`)?.classList.add('active')
}

export function triggerPeAutosave(): void {
  const status = document.getElementById('pe-autosave-status')
  if (status) status.textContent = '● Unsaved changes'

  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => savePricingAdmin(true), 2000)
}

export async function savePricingAdmin(isAutosave = false): Promise<void> {
  const btn = document.getElementById('pe-save-btn') as HTMLButtonElement | null
  const status = document.getElementById('pe-autosave-status')

  if (!isAutosave && btn) {
    btn.textContent = 'Saving…'
    btn.disabled = true
  }
  if (status) status.textContent = '○ Saving…'

  try {
    if (currentData) snapshotTab()
    const data = currentData!
    await savePricingData(data)
    window.dispatchEvent(new CustomEvent('pricingDataUpdated', { detail: data }))

    if (!isAutosave && btn) {
      btn.textContent = 'Saved!'
      setTimeout(() => { if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false } }, 2000)
    }
    if (status) status.textContent = '✓ Saved'
    autosaveTimer = null
  } catch (e) {
    if (!isAutosave && btn) {
      btn.textContent = 'Error — retry'
      btn.disabled = false
    }
    if (status) status.textContent = '⚠ Save failed'
    console.error('[PricingEngine] Save failed:', e)
  }
}

// ── Actions called by chat-ui.ts ──────────────────────────────────────────────

export function applyAddLibraryItem(item: CostItem): void {
  if (currentTab !== 'library') switchPeTab('library')
  const tbody = document.getElementById('pe-library-tbody')
  if (!tbody) return
  const tr = document.createElement('tr')
  tr.dataset.id = item.id
  tr.innerHTML = libraryRowHTML(item)
  tbody.appendChild(tr)
  tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  triggerPeAutosave()
}

export function applyCreateTemplate(t: ProductTemplate): void {
  if (!currentData) return
  if (currentTab !== 'experiences') switchPeTab('experiences')
  const list = document.getElementById('pe-templates-list')
  if (!list) return
  const div = document.createElement('div')
  div.innerHTML = renderTemplateCard(t, currentData.library, 'experience')
  list.appendChild(div.firstElementChild!)
  div.firstElementChild?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  triggerPeAutosave()
}

export function applyUpdateCost(id: string, cost: number): void {
  if (currentTab !== 'library') switchPeTab('library')
  document.querySelectorAll<HTMLTableRowElement>('#pe-library-tbody tr').forEach(row => {
    if (row.dataset.id === id) {
      ;(row.querySelector('.pe-lib-cost') as HTMLInputElement).value = String(cost)
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
  triggerPeAutosave()
}

// ── DOM mutators exposed to window.* ─────────────────────────────────────────

export function addPeLibraryRow(): void {
  const tbody = document.getElementById('pe-library-tbody')
  if (!tbody) return
  const tr = document.createElement('tr')
  tr.dataset.id = genId()
  tr.innerHTML = libraryRowHTML({ id: '', name: '', cost: 0 })
  tbody.appendChild(tr)
  ;(tr.querySelector('.pe-lib-name') as HTMLInputElement)?.focus()
  triggerPeAutosave()
}

export function removePeLibraryRow(btn: HTMLElement): void {
  btn.closest('tr')?.remove()
  triggerPeAutosave()
}

export function addPeTemplate(): void {
  const list = document.getElementById('pe-templates-list')
  if (!list || !currentData) return
  const isService = currentTab === 'services'
  const t: ProductTemplate = {
    id: (isService ? 'SERVICE_' : 'TEMPLATE_') + Date.now(),
    name: isService ? 'New Service' : 'New Experience',
    type: isService ? 'service' : 'experience',
    fixed_cost_refs: [],
    variable_cost_refs: [],
    markup: 1.0
  }
  const div = document.createElement('div')
  div.innerHTML = renderTemplateCard(t, currentData.library, t.type!)
  list.appendChild(div.firstElementChild!)
  triggerPeAutosave()
}

export function removePeTemplate(btn: HTMLElement): void {
  btn.closest('.pe-template-card')?.remove()
  triggerPeAutosave()
}

export function peAddCostItem(sel: HTMLSelectElement): void {
  const itemId = sel.value
  if (!itemId || !currentData) return
  sel.value = ''
  const card = sel.closest('.pe-template-card') as HTMLElement | null
  if (!card) return
  if (card.querySelector(`.pe-cost-chip[data-item-id="${itemId}"]`)) return // already added
  const item = currentData.library.find(i => i.id === itemId)
  if (!item) return
  const chip = document.createElement('div')
  chip.className = 'pe-cost-chip'
  chip.dataset.itemId = itemId
  chip.innerHTML = chipHTML(item.id, item.name, false)
  card.querySelector('.pe-cost-chips')?.appendChild(chip)
  triggerPeAutosave()
}

// ── Snapshot helper ───────────────────────────────────────────────────────────

function snapshotTab(): void {
  if (!currentData) return
  if (currentTab === 'library') {
    currentData = { ...currentData, library: readLibraryFromDOM().sort((a, b) => a.name.localeCompare(b.name)) }
  } else {
    const isService = currentTab === 'services'
    const fromDOM = readTemplatesFromDOM()
      .map(t => ({ ...t, type: isService ? 'service' : 'experience' } as ProductTemplate))
      .sort((a, b) => a.name.localeCompare(b.name))
    // Preserve the other type's templates from currentData
    const other = currentData.templates.filter(t =>
      isService ? t.type !== 'service' : t.type === 'service'
    )
    currentData = { ...currentData, templates: [...fromDOM, ...other] }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderOverlay(): void {
  const overlay = document.getElementById('pricing-overlay')
  if (!overlay) return
  overlay.innerHTML = `
    <div class="pe-panel" oninput="window.triggerPeAutosave()" onchange="window.triggerPeAutosave()">
      <div class="pe-header">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="pe-title">Edit Extra Services</div>
          <div id="pe-autosave-status" style="font-size:10px; color:var(--text-dim); font-family:monospace;">✓ Saved</div>
        </div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${currentTab === 'library'     ? ' active' : ''}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${currentTab === 'experiences' ? ' active' : ''}" id="pe-tab-experiences"
          onclick="window.switchPeTab('experiences')">Experiences</button>
        <button class="pe-tab${currentTab === 'services'    ? ' active' : ''}" id="pe-tab-services"
          onclick="window.switchPeTab('services')">Services</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
    </div>
  `
  renderTabContent()
}

function renderTabContent(): void {
  const body = document.getElementById('pe-tab-body')
  if (!body || !currentData) return
  if (currentTab === 'library') {
    body.innerHTML = renderLibrary(currentData.library)
  } else if (currentTab === 'experiences') {
    const experiences = currentData.templates.filter(t => t.type !== 'service')
    body.innerHTML = renderTemplates(experiences, currentData.library, 'experience')
  } else {
    const services = currentData.templates.filter(t => t.type === 'service')
    body.innerHTML = renderTemplates(services, currentData.library, 'service')
  }
}

// ── Library tab ───────────────────────────────────────────────────────────────

function renderLibrary(library: CostItem[]): string {
  const sorted = [...library].sort((a, b) => a.name.localeCompare(b.name))
  const rows = sorted.map(item => `<tr data-id="${esc(item.id)}">${libraryRowHTML(item)}</tr>`).join('')
  return `
    <div class="pe-section-hint">Costs in IDR.</div>
    <table class="pe-table">
      <thead><tr><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${rows}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `
}

function libraryRowHTML(item: CostItem): string {
  return `
    <td><input class="pe-input pe-lib-name" value="${esc(item.name)}" placeholder="Name" style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${item.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `
}

// ── Experiences / Services tab ────────────────────────────────────────────────

function renderTemplates(templates: ProductTemplate[], library: CostItem[], type: 'experience' | 'service'): string {
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name))
  const label = type === 'experience' ? 'Experience' : 'Service'
  return `
    <div id="pe-templates-list">${sorted.map(t => renderTemplateCard(t, library, type)).join('')}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add ${label}</button>
  `
}

function chipHTML(id: string, name: string, isFixed: boolean): string {
  return `
    <span class="pe-chip-name">${esc(name)}</span>
    <label class="pe-fixed-label">
      <input type="checkbox" class="pe-fixed-check" value="${esc(id)}" ${isFixed ? 'checked' : ''}>
      fixed ÷pax
    </label>
    <button class="pe-del-btn" onclick="this.closest('.pe-cost-chip').remove()" title="Remove">✕</button>
  `
}

function renderTemplateCard(t: ProductTemplate, library: CostItem[], type: 'experience' | 'service'): string {
  const included = [...t.fixed_cost_refs, ...t.variable_cost_refs]
  const chips = included.map(id => {
    const item = library.find(i => i.id === id)
    if (!item) return ''
    return `<div class="pe-cost-chip" data-item-id="${esc(id)}">${chipHTML(id, item.name, t.fixed_cost_refs.includes(id))}</div>`
  }).join('')

  const options = library.map(item =>
    `<option value="${esc(item.id)}">${esc(item.name)}</option>`
  ).join('')

  return `
    <div class="pe-template-card" data-id="${esc(t.id)}" data-type="${type}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${esc(t.name)}" placeholder="${type === 'experience' ? 'Experience' : 'Service'} name"
            style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${t.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Costs</div>
        <select class="pe-input pe-add-cost" onchange="window.peAddCostItem(this)">
          <option value="">＋ Add cost item…</option>
          ${options}
        </select>
        <div class="pe-cost-chips">${chips}</div>
      </div>
    </div>
  `
}

// ── DOM readers ───────────────────────────────────────────────────────────────

function readLibraryFromDOM(): CostItem[] {
  const library: CostItem[] = []
  document.querySelectorAll<HTMLTableRowElement>('#pe-library-tbody tr[data-id]').forEach(row => {
    const id   = row.dataset.id!
    const name = (row.querySelector('.pe-lib-name') as HTMLInputElement)?.value.trim()
    const cost = parseFloat((row.querySelector('.pe-lib-cost') as HTMLInputElement)?.value) || 0
    if (name) library.push({ id, name, cost })
  })
  return library
}

function readTemplatesFromDOM(): ProductTemplate[] {
  const templates: ProductTemplate[] = []
  document.querySelectorAll<HTMLElement>('.pe-template-card[data-id]').forEach(card => {
    const id     = card.dataset.id!
    const name   = (card.querySelector('.pe-tname')  as HTMLInputElement)?.value.trim() || id
    const markup = parseFloat((card.querySelector('.pe-markup') as HTMLInputElement)?.value) || 1.0
    const type   = (card.dataset.type as 'experience' | 'service' | undefined) ?? 'experience'
    const fixed_cost_refs: string[] = []
    const variable_cost_refs: string[] = []
    card.querySelectorAll<HTMLElement>('.pe-cost-chip[data-item-id]').forEach(chip => {
      const itemId = chip.dataset.itemId!
      const fixedBox = chip.querySelector<HTMLInputElement>('.pe-fixed-check')
      if (fixedBox?.checked) fixed_cost_refs.push(itemId)
      else variable_cost_refs.push(itemId)
    })
    templates.push({ id, name, markup, type, fixed_cost_refs, variable_cost_refs })
  })
  return templates
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function genId(): string {
  return 'item_' + Math.random().toString(36).slice(2, 10)
}
