import type { CostItem, PricingData, ProductTemplate } from './types'
import { savePricingData, loadPricingData } from './store'

let currentData: PricingData | null = null
let currentTab: 'library' | 'templates' = 'library'

// ── Public API ────────────────────────────────────────────────────────────────

export function openAdmin(): void {
  loadPricingData().then(data => {
    currentData = JSON.parse(JSON.stringify(data))
    renderOverlay()
    document.getElementById('pricing-overlay')?.classList.add('open')
  })
}

export function closeAdmin(): void {
  document.getElementById('pricing-overlay')?.classList.remove('open')
}

export function switchPeTab(tab: 'library' | 'templates'): void {
  currentTab = tab
  renderTabContent()
  document.querySelectorAll('.pe-tab').forEach(b => b.classList.remove('active'))
  document.getElementById(`pe-tab-${tab}`)?.classList.add('active')
}

export async function savePricingAdmin(): Promise<void> {
  const btn = document.getElementById('pe-save-btn') as HTMLButtonElement | null
  if (!btn) return
  const original = btn.textContent
  btn.textContent = 'Saving…'
  btn.disabled = true

  try {
    const data = readDataFromDOM()
    await savePricingData(data)
    currentData = data
    window.dispatchEvent(new CustomEvent('pricingDataUpdated', { detail: data }))
    btn.textContent = 'Saved!'
    setTimeout(() => { btn.textContent = original; btn.disabled = false }, 2000)
  } catch (e) {
    btn.textContent = 'Error — retry'
    btn.disabled = false
    console.error('[PricingEngine] Save failed:', e)
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderOverlay(): void {
  const overlay = document.getElementById('pricing-overlay')
  if (!overlay) return
  overlay.innerHTML = `
    <div class="pe-panel">
      <div class="pe-header">
        <div class="pe-title">Cost Calculation</div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${currentTab === 'library' ? ' active' : ''}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${currentTab === 'templates' ? ' active' : ''}" id="pe-tab-templates"
          onclick="window.switchPeTab('templates')">Templates</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
      <div class="pe-footer">
        <button class="pill-btn dark" id="pe-save-btn" onclick="window.savePricingAdmin()">Save Changes</button>
      </div>
    </div>
  `
  renderTabContent()
}

function renderTabContent(): void {
  const body = document.getElementById('pe-tab-body')
  if (!body || !currentData) return
  body.innerHTML = currentTab === 'library'
    ? renderLibrary(currentData.library)
    : renderTemplates(currentData.templates, currentData.library)
}

// ── Library tab ───────────────────────────────────────────────────────────────

function renderLibrary(library: CostItem[]): string {
  const rows = library.map(item => `
    <tr data-id="${esc(item.id)}">
      <td><input class="pe-input pe-lib-id" value="${esc(item.id)}" placeholder="ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
      <td><input class="pe-input pe-lib-name" value="${esc(item.name)}" placeholder="Name" style="width:100%;"></td>
      <td><input class="pe-input pe-lib-cost" type="number" value="${item.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
      <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
    </tr>
  `).join('')

  return `
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${rows}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function renderTemplates(templates: ProductTemplate[], library: CostItem[]): string {
  return `
    <div id="pe-templates-list">${templates.map(t => renderTemplateCard(t, library)).join('')}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `
}

function renderTemplateCard(t: ProductTemplate, library: CostItem[]): string {
  const checks = (cls: string, refs: string[]) => library.map(item => `
    <label class="pe-check-row">
      <input type="checkbox" class="${cls}" value="${esc(item.id)}"
        ${refs.includes(item.id) ? 'checked' : ''}
        onchange="window.enforceMutualExclusion(this)">
      ${esc(item.name)} <span class="pe-check-id">${esc(item.id)}</span>
    </label>
  `).join('')

  return `
    <div class="pe-template-card" data-id="${esc(t.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${esc(t.name)}" placeholder="Template name" style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${t.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete template">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Fixed Costs <span class="pe-costs-hint">(shared ÷ pax)</span></div>
        <div class="pe-checks">${checks('pe-fixed-check', t.fixed_cost_refs)}</div>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Variable Costs <span class="pe-costs-hint">(per person)</span></div>
        <div class="pe-checks">${checks('pe-var-check', t.variable_cost_refs)}</div>
      </div>
    </div>
  `
}

// ── DOM mutators ──────────────────────────────────────────────────────────────

export function addPeLibraryRow(): void {
  const tbody = document.getElementById('pe-library-tbody')
  if (!tbody) return
  const tr = document.createElement('tr')
  tr.dataset.id = '_new_' + Date.now()
  tr.innerHTML = `
    <td><input class="pe-input pe-lib-id" value="" placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="" placeholder="Name" style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="0" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)">✕</button></td>
  `
  tbody.appendChild(tr)
  ;(tr.querySelector('.pe-lib-id') as HTMLInputElement)?.focus()
}

export function removePeLibraryRow(btn: HTMLElement): void {
  btn.closest('tr')?.remove()
}

export function addPeTemplate(): void {
  const list = document.getElementById('pe-templates-list')
  if (!list || !currentData) return
  const t: ProductTemplate = {
    id: 'TEMPLATE_' + Date.now(),
    name: 'New Template',
    fixed_cost_refs: [],
    variable_cost_refs: [],
    markup: 1.4
  }
  const div = document.createElement('div')
  div.innerHTML = renderTemplateCard(t, currentData.library)
  list.appendChild(div.firstElementChild!)
}

export function removePeTemplate(btn: HTMLElement): void {
  btn.closest('.pe-template-card')?.remove()
}

export function enforceMutualExclusion(checkbox: HTMLInputElement): void {
  if (!checkbox.checked) return
  const card = checkbox.closest('.pe-template-card')
  if (!card) return
  const isFixed = checkbox.classList.contains('pe-fixed-check')
  const other = card.querySelector(
    `${isFixed ? '.pe-var-check' : '.pe-fixed-check'}[value="${checkbox.value}"]`
  ) as HTMLInputElement | null
  if (other) other.checked = false
}

// ── DOM reader ────────────────────────────────────────────────────────────────

function readDataFromDOM(): PricingData {
  const library: CostItem[] = []
  document.querySelectorAll<HTMLTableRowElement>('#pe-library-tbody tr[data-id]').forEach(row => {
    const id   = (row.querySelector('.pe-lib-id')   as HTMLInputElement)?.value.trim()
    const name = (row.querySelector('.pe-lib-name') as HTMLInputElement)?.value.trim()
    const cost = parseFloat((row.querySelector('.pe-lib-cost') as HTMLInputElement)?.value) || 0
    if (id && name) library.push({ id, name, cost })
  })

  const templates: ProductTemplate[] = []
  document.querySelectorAll<HTMLElement>('.pe-template-card[data-id]').forEach(card => {
    const id     = card.dataset.id!
    const name   = (card.querySelector('.pe-tname')  as HTMLInputElement)?.value.trim() || id
    const markup = parseFloat((card.querySelector('.pe-markup') as HTMLInputElement)?.value) || 1.0
    const fixed_cost_refs    = Array.from(card.querySelectorAll<HTMLInputElement>('.pe-fixed-check:checked')).map(el => el.value)
    const variable_cost_refs = Array.from(card.querySelectorAll<HTMLInputElement>('.pe-var-check:checked')).map(el => el.value)
    templates.push({ id, name, markup, fixed_cost_refs, variable_cost_refs })
  })

  return { library, templates }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
