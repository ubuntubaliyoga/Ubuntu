import type { PricingData } from './types'
import { applyAddLibraryItem, applyCreateTemplate, applyUpdateCost } from './admin-ui'

interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface ToolCall  { name: string; input: Record<string, unknown> }

let history: ChatMsg[] = []
const pending = new Map<string, ToolCall>()

export function clearChatHistory(): void {
  history = []
}

export async function sendPeChat(): Promise<void> {
  const input   = document.getElementById('pe-chat-input')  as HTMLInputElement  | null
  const sendBtn = document.getElementById('pe-chat-send')   as HTMLButtonElement | null
  const msgBox  = document.getElementById('pe-chat-messages')
  if (!input || !msgBox) return

  const message = input.value.trim()
  if (!message) return

  appendMsg(msgBox, 'user', message)
  input.value = ''
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…' }
  msgBox.scrollTop = msgBox.scrollHeight

  try {
    const res = await fetch('/api/pricing-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        pricingData: window._pricingData,
        history
      })
    })

    const data = await res.json() as { reply: string; toolCall: ToolCall | null }

    history.push({ role: 'user', content: message })
    if (data.reply) {
      history.push({ role: 'assistant', content: data.reply })
      appendMsg(msgBox, 'assistant', data.reply)
    }

    if (data.toolCall) {
      const id = 'pe-action-' + Date.now()
      pending.set(id, data.toolCall)
      appendActionCard(msgBox, id, data.toolCall)
    }
  } catch {
    appendMsg(msgBox, 'assistant', '⚠ Request failed. Try again.')
  }

  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send' }
  msgBox.scrollTop = msgBox.scrollHeight
}

export function applyPeAction(id: string): void {
  const toolCall = pending.get(id)
  if (!toolCall) return
  pending.delete(id)

  const { name, input } = toolCall
  if (name === 'add_library_item')
    applyAddLibraryItem(input as any)
  else if (name === 'create_template')
    applyCreateTemplate(input as any)
  else if (name === 'update_cost')
    applyUpdateCost(input.id as string, input.cost as number)

  document.getElementById(id)?.remove()
  pulseSaveBtn()
}

export function dismissPeAction(id: string): void {
  pending.delete(id)
  document.getElementById(id)?.remove()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function appendMsg(box: HTMLElement, role: 'user' | 'assistant', text: string): void {
  const div = document.createElement('div')
  div.className = `pe-chat-msg pe-chat-msg-${role}`
  div.textContent = text
  box.appendChild(div)
}

function appendActionCard(box: HTMLElement, id: string, toolCall: ToolCall): void {
  const div = document.createElement('div')
  div.className = 'pe-action-card'
  div.id = id
  div.innerHTML = `
    <div class="pe-action-label">${actionLabel(toolCall)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${id}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${id}')">Dismiss</button>
    </div>
  `
  box.appendChild(div)
}

function actionLabel({ name, input }: ToolCall): string {
  const fmt = (n: unknown) => Number(n).toLocaleString('id-ID')
  if (name === 'add_library_item')  return `Add "${input.name}" — IDR ${fmt(input.cost)}`
  if (name === 'create_template')   return `Create template "${input.name}" (markup ×${input.markup})`
  if (name === 'update_cost')       return `Update ${input.id} → IDR ${fmt(input.cost)}`
  return name
}

function pulseSaveBtn(): void {
  const btn = document.getElementById('pe-save-btn') as HTMLButtonElement | null
  if (!btn) return
  btn.classList.add('pe-save-pulse')
  setTimeout(() => btn.classList.remove('pe-save-pulse'), 2000)
}
