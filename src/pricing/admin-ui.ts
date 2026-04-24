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
}

export function applyCreateTemplate(t: ProductTemplate): void {
  if (!currentData) return
  if (currentTab !== 'templates') switchPeTab('templates')
  const list = document.getElementById('pe-templates-list')
  if (!list) return
  const div = document.createElement('div')
  div.innerHTML = renderTemplateCard(t, currentData.library)
  list.appendChild(div.firstElementChild!)
  div.firstElementChild?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}

export function applyUpdateCost(id: string, cost: number): void {
  if (currentTab !== 'library') switchPeTab('library')
  document.querySelectorAll<HTMLTableRowElement>('#pe-library-tbody tr').forEach(row => {
    if (row.dataset.id === id) {
      ;(row.querySelector('.pe-lib-cost') as HTMLInputElement).value = String(cost)
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

// ── DOM mutators exposed to window.* ─────────────────────────────────────────

export function addPeLibraryRow(): void {
  const tbody = document.getElementById('pe-library-tbody')
  if (!tbody) return
  const tr = document.createElement('tr')
  tr.dataset.id = '_new_' + Date.now()
  tr.innerHTML = libraryRowHTML({ id: '', name: '', cost: 0 }, true)
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
      <div class="pe-chat">
        <div class="pe-chat-header">
          <span>AI Assistant</span>
          <span class="pe-chat-hint">Add items · create templates · explain pricing</span>
        </div>
        <div class="pe-chat-messages" id="pe-chat-messages">
          <div class="pe-chat-msg pe-chat-msg-assistant">Ask me anything — e.g. "Add a rafting guide at 180,000 IDR" or "What's the price per person for 3 people on the trekking tour?"</div>
        </div>
        <div class="pe-chat-input-row">
          <input type="text" id="pe-chat-input" class="pe-input"
            placeholder="Ask or instruct…"
            onkeydown="if(event.key==='Enter')window.sendPeChat()">
          <button class="pill-btn dark" id="pe-chat-send" onclick="window.sendPeChat()">Send</button>
        </div>
      </div>
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
  const rows = library.map(item => `<tr data-id="${esc(item.id)}">${libraryRowHTML(item)}</tr>`).join('')
  return `
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${rows}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `
}

function libraryRowHTML(item: CostItem, empty = false): string {
  return `
    <td><input class="pe-input pe-lib-id"   value="${esc(item.id)}"   placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"${empty ? '' : ''}></td>
    <td><input class="pe-input pe-lib-name" value="${esc(item.name)}" placeholder="Name"    style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${item.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
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
  const costRows = library.map(item => {
    const isFixed = t.fixed_cost_refs.includes(item.id)
    const included = isFixed || t.variable_cost_refs.includes(item.id)
    return `
      <div class="pe-check-row">
        <input type="checkbox" class="pe-include-check" value="${esc(item.id)}" ${included ? 'checked' : ''}
          onchange="this.closest('.pe-check-row').querySelector('.pe-fixed-label').classList.toggle('pe-fixed-dim',!this.checked)">
        <span class="pe-check-name">${esc(item.name)} <span class="pe-check-id">${esc(item.id)}</span></span>
        <label class="pe-fixed-label${included ? '' : ' pe-fixed-dim'}">
          <input type="checkbox" class="pe-fixed-check" value="${esc(item.id)}" ${isFixed ? 'checked' : ''}>
          fixed ÷pax
        </label>
      </div>
    `
  }).join('')

  return `
    <div class="pe-template-card" data-id="${esc(t.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${esc(t.name)}" placeholder="Template name"
            style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${t.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete template">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Costs</div>
        <div class="pe-cost-note">Tick to include. Check "fixed ÷pax" for group costs split by headcount (e.g. transport); leave unticked for per-person costs (e.g. entrance fee, guide).</div>
        <div class="pe-checks">${costRows}</div>
      </div>
    </div>
  `
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
    const fixed_cost_refs: string[] = []
    const variable_cost_refs: string[] = []
    card.querySelectorAll<HTMLInputElement>('.pe-include-check:checked').forEach(el => {
      const fixedBox = card.querySelector<HTMLInputElement>(`.pe-fixed-check[value="${el.value}"]`)
      if (fixedBox?.checked) fixed_cost_refs.push(el.value)
      else variable_cost_refs.push(el.value)
    })
    templates.push({ id, name, markup, fixed_cost_refs, variable_cost_refs })
  })

  return { library, templates }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
