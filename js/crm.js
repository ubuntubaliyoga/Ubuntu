// js/crm.js

// ── STATE ─────────────────────────────────────────────────────────────────────
let crmData = { emailLeads: [], whatsappLeads: [], shalaLeads: [], converted: [] };
let crmTab = 'cold';
let crmCollapsed = {};
let crmLoaded = false;
let _moveLeadId = null; // id of lead selected for tab-move (long-press pattern)

const REACHED_OUT_OPTIONS = ['Email', 'Instagram', 'LinkedIn', 'WhatsApp', 'In Person', 'Cold Call'];

const CLOSED_STATUSES = ['SALE CLOSED', 'Converted to Customer'];
const WARM_STATUSES   = ['WARM: Booked a call OR asked for help', 'HOT: Past client/strong conversation', 'QUALIFIED TO BUY', 'Booked a call', 'Sent an offer'];
const DEAD_STATUSES   = ['GHOSTED', 'TERMINATED', 'NOT GOOD FIT'];

const SRC_CFG = {
  email:    { label: '📧 Email',    color: '#1565C0', bg: '#E3F2FD' },
  whatsapp: { label: '💬 WhatsApp', color: '#2E7D32', bg: '#E8F5E9' },
  shala:    { label: '🏛 Shala',    color: '#E65100', bg: '#FFF3E0' },
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function allLeads() {
  return [
    ...(crmData.emailLeads    || []),
    ...(crmData.whatsappLeads || []),
    ...(crmData.shalaLeads    || []),
  ];
}

function getStageKey(c) {
  const s = Array.isArray(c.status) ? c.status[0] : c.status;
  if (CLOSED_STATUSES.includes(s)) return 'closed';
  if (WARM_STATUSES.includes(s))   return 'warm';
  if (DEAD_STATUSES.includes(s))   return 'dead';
  return 'cold';
}

function cleanLocation(loc) {
  if (!loc) return null;
  if (loc.includes('maps.google.com') || loc.startsWith('http')) {
    const m = loc.match(/[?&]q=([^&]+)/);
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ');
    return null;
  }
  return loc;
}

function suitClass(s) {
  if (!s) return '';
  if (s.startsWith('1')) return 'crm-suit-1';
  if (s.startsWith('2')) return 'crm-suit-2';
  if (s.startsWith('3')) return 'crm-suit-3';
  return 'crm-suit-4';
}

// Smart date formatter — handles both ISO date strings AND free text
function fmtDateShort(s) {
  if (!s) return null;
  // Try ISO date format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d)) return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  // Return raw text as-is (e.g. "10/04/2026" or other free text)
  return s;
}

// ── TAB ───────────────────────────────────────────────────────────────────────
function crmSwitchTab(tab) {
  if (_moveLeadId) {
    const id = _moveLeadId;
    clearMoveSelection();
    dropLeadOnTab(id, tab);
    return;
  }
  crmTab = tab;
  ['cold', 'converted', 'closed', 'shala'].forEach(t => {
    document.getElementById('crm-tab-' + t)?.classList.toggle('active', t === tab);
  });
  crmRender();
}

function setMoveSelection(id) {
  _moveLeadId = id;
  if (navigator.vibrate) navigator.vibrate(40);
  ['crm-tab-cold','crm-tab-converted','crm-tab-closed'].forEach(tabId => {
    document.getElementById(tabId)?.classList.add('move-target');
  });
  const card = document.querySelector(`[data-lead-id="${id}"]`);
  if (card) card.classList.add('crm-card-selected');
}

function clearMoveSelection() {
  _moveLeadId = null;
  ['crm-tab-cold','crm-tab-converted','crm-tab-closed'].forEach(tabId => {
    document.getElementById(tabId)?.classList.remove('move-target');
  });
  document.querySelectorAll('.crm-card-selected').forEach(c => c.classList.remove('crm-card-selected'));
}

function tabItems() {
  if (crmTab === 'shala')     return crmData.shalaLeads || [];
  if (crmTab === 'converted') return crmData.converted  || [];
  if (crmTab === 'closed')    return allLeads().filter(c => getStageKey(c) === 'closed');
  return allLeads().filter(c => {
    const s = getStageKey(c);
    return s === 'cold' || s === 'warm' || s === 'dead';
  });
}

// ── SORT ──────────────────────────────────────────────────────────────────────
function crmSort(items) {
  const g = document.getElementById('crm-group')?.value || 'date';
  if (g === 'name')     return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (g === 'location') return [...items].sort((a, b) => (cleanLocation(a.location)||'').localeCompare(cleanLocation(b.location)||''));
  return [...items].sort((a, b) => new Date(b.lastEdited || 0) - new Date(a.lastEdited || 0));
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function updateTabCounts() {
  const allL = allLeads();
  const counts = {
    cold:      allL.filter(c => getStageKey(c) !== 'closed').length,
    converted: (crmData.converted || []).length,
    closed:    allL.filter(c => getStageKey(c) === 'closed').length,
    shala:     (crmData.shalaLeads || []).length,
  };
  const names = { cold: 'Cold', converted: 'Warm', closed: 'Closed', shala: 'Shala' };
  Object.entries(counts).forEach(([tab, n]) => {
    const el = document.querySelector(`#crm-tab-${tab} .tab-label`);
    if (el) el.textContent = `${names[tab]} (${n})`;
  });
}

function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const search = (document.getElementById('crm-search')?.value || '').toLowerCase();
  let items = tabItems().filter(c =>
    !search || ((c.name || '') + (c.location || '') + (c.company || '')).toLowerCase().includes(search)
  );

  updateTabCounts();

  items = crmSort(items);
  list.innerHTML = items.length ? buildList(items) : '<div class="crm-empty">No leads found.</div>';
}

// ── CARD LIST ─────────────────────────────────────────────────────────────────
function buildList(items) {
  return items.map(c => {
    const src      = SRC_CFG[c.db] || SRC_CFG.email;
    const reached  = c.reachedOutOn || [];
    const loc      = cleanLocation(c.location);
    const stage    = getStageKey(c);
    const firstOut = c.engagedFirst ? fmtDateShort(c.engagedFirst) : null;

    const stageBadge = stage === 'warm'
      ? `<span class="crm-badge" style="background:#E3F2FD;color:#1565C0;">🔥 Warm</span>`
      : stage === 'dead'
      ? `<span class="crm-badge" style="background:#F0EBE3;color:#8B7355;">👻 Dead</span>`
      : '';

    const metaParts = [
      loc      && `<span>📍 ${loc}</span>`,
      firstOut && `<span>🗓 ${firstOut}</span>`,
    ].filter(Boolean);

    const srcLabel = src.label.replace(/^\S+\s/, '');
    const reachedChips = reached
      .filter(r => r !== srcLabel)
      .map(r => `<span class="crm-badge" style="background:var(--bg2);color:var(--muted);">${r}</span>`)
      .join('');

    const notePreview = c.notes
      ? `<div class="crm-card-notes">${c.notes.length > 80 ? c.notes.slice(0, 80) + '…' : c.notes}</div>`
      : '';

    const offerCount = (window._drafts || []).filter(d => d.linkedLeadId === c.id).length;
    const offerBadge = offerCount
      ? `<span class="crm-badge" style="background:var(--bg2);color:var(--dark);border:1px solid var(--border);">✦ ${offerCount} offer${offerCount > 1 ? 's' : ''}</span>`
      : '';

    return `<div class="crm-card" data-lead-id="${c.id}" draggable="true" ondragstart="startLeadDrag(event,'${c.id}')" onclick="openCrmModal('${c.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div style="min-width:0;">
          <div class="crm-card-name">${c.name || 'Unnamed'}</div>
          ${metaParts.length ? `<div class="crm-card-meta">${metaParts.join('<span style="margin:0 4px;opacity:.4;">·</span>')}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span class="crm-badge" style="background:${src.bg};color:${src.color};">${src.label}</span>
          ${stageBadge}
          ${offerBadge}
          ${reachedChips}
        </div>
      </div>
      ${notePreview}
    </div>`;
  }).join('');
}

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadCRM(force = false) {
  if (crmLoaded && !force) { crmRender(); return; }

  const list = document.getElementById('crm-list');
  if (list) list.innerHTML = '<div class="crm-empty">Loading…</div>';
  const btn = document.getElementById('crm-refresh-btn');
  if (btn) { btn.textContent = '↻ Loading…'; btn.disabled = true; }

  try {
    const r = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load' }),
    });
    if (!r.ok) throw new Error(await r.text());
    crmData = await r.json();
    crmLoaded = true;
    dbg(`CRM: ${(crmData.emailLeads||[]).length} email, ${(crmData.whatsappLeads||[]).length} whatsapp, ${(crmData.shalaLeads||[]).length} shala, ${(crmData.converted||[]).length} converted`);
    fetchDraftsData().then(() => crmRender());
    initCrmDragDrop();
  } catch (e) {
    if (list) list.innerHTML = `<div class="crm-empty" style="color:#B71C1C;">Could not load: ${e.message}</div>`;
    dbg('CRM load failed: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openCrmModal(id) {
  const c = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function openCrmModalEdit(id) {
  const c = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmEditHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function closeCrmModal(e) {
  if (!e || e.target === document.getElementById('crm-modal'))
    document.getElementById('crm-modal').classList.remove('open');
}

function crmDetailHTML(c) {
  const src     = SRC_CFG[c.db] || SRC_CFG.email;
  const reached = Array.isArray(c.reachedOutOn) ? c.reachedOutOn : [];
  const isLead  = c.db !== 'converted';
  const loc     = cleanLocation(c.location);

  const allOptions = [...REACHED_OUT_OPTIONS];
  reached.forEach(r => { if (!allOptions.includes(r)) allOptions.push(r); });

  const fields = [
    c.email      && ['Email',        `<a href="mailto:${c.email}" style="color:var(--gold);">${c.email}</a>`],
    c.insta      && ['Instagram',    c.insta],
    c.website    && ['Website',      `<a href="${c.website}" target="_blank" style="color:var(--gold);">${c.website}</a>`],
    c.linkedin   && ['LinkedIn',     c.linkedin],
    (c.whatsapp && c.db !== 'whatsapp') && ['WhatsApp', c.whatsapp],
    c.whatsapp2  && ['WhatsApp 2',   c.whatsapp2],
    c.company    && ['Company',      c.company],
    c.engagedFirst && ['First outreach', fmtDateShort(c.engagedFirst)],
    c.engagedLast  && ['Last contact',   fmtD(c.engagedLast)],
    c.engageNext   && ['Engage next',    fmtD(c.engageNext)],
  ].filter(Boolean);

  return `
    <div class="modal-header">
      <div>
        <div class="modal-title">${c.name || 'Unnamed'}</div>
        ${loc ? `<div class="modal-sub">📍 ${loc}</div>` : ''}
      </div>
      <button class="modal-close" onclick="document.getElementById('crm-modal').classList.remove('open')">✕</button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
      <span class="crm-badge" style="background:${src.bg};color:${src.color};">${src.label}</span>
    </div>

    <div class="crm-section-hd">Reached Out On</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;" id="reached-out-tags">
      ${allOptions.map(opt => {
        const active = reached.includes(opt);
        return `<button class="reach-btn${active ? ' active' : ''}" data-opt="${opt}"
          onclick="toggleReachedOut('${c.id}','${c.db}',this)">${opt}</button>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-bottom:16px;">
      <input id="custom-reached-input" type="text" placeholder="+ Custom…"
        style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:100px;font-family:'Inter',sans-serif;font-size:16px;background:var(--bg);outline:none;min-width:0;-webkit-appearance:none;">
      <button onclick="addCustomReachedOut('${c.id}','${c.db}')"
        style="padding:9px 16px;border-radius:100px;border:1px solid var(--border);background:transparent;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);white-space:nowrap;flex-shrink:0;">Add</button>
    </div>

    <div class="crm-section-hd">Notes</div>
    <textarea id="notes-editor-${c.id}"
      onchange="saveNotes('${c.id}','${c.db}',this.value)"
      onblur="saveNotes('${c.id}','${c.db}',this.value)"
      placeholder="Add notes…"
      style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'Inter',sans-serif;font-size:13px;background:var(--bg);outline:none;resize:vertical;min-height:70px;line-height:1.6;"
    >${c.notes||''}</textarea>

    ${fields.length ? `<div class="crm-section-hd">Info</div>
      ${fields.map(([label, val]) => `<div class="crm-field"><div class="crm-field-label">${label}</div><div style="font-size:13px;flex:1;word-break:break-word;">${val}</div></div>`).join('')}` : ''}

    ${(() => {
      const linked = (window._drafts || []).map((d, i) => ({ ...d, _i: i })).filter(d => d.linkedLeadId === c.id);
      if (!linked.length) return '';
      return `<div class="crm-section-hd">Offers</div>` + linked.map(d => {
        const total = d.totalUSD ? 'USD ' + Number(d.totalUSD).toLocaleString('en-US') : '—';
        const dates = d.checkin ? fmtDateShort(d.checkin) + ' → ' + fmtDateShort(d.checkout) : 'No dates';
        const statusColor = { Draft:'#8C9476', Sent:'#1565C0', Signed:'#2E7D32', Cancelled:'#B71C1C' }[d.status] || '#8C9476';
        return `<div onclick="loadDraftFromCrm(${d._i})" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg2);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;gap:8px;">
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:2px;">${d.retreatName || d.organizer || 'Unnamed offer'}</div>
            <div style="font-size:11px;color:var(--muted);">${dates} · ${total}</div>
          </div>
          <span style="font-size:10px;font-weight:600;color:${statusColor};white-space:nowrap;flex-shrink:0;">${d.status || 'Draft'}</span>
        </div>`;
      }).join('');
    })()}

    <div class="modal-actions" style="flex-wrap:wrap;gap:8px;">
      <button onclick="newDraftFromLead('${c.id}','${(c.name||'').replace(/'/g,"\\'")}');" class="pill-btn dark" style="flex:1;min-width:140px;">✦ Create new offer</button>
      <button onclick="openCrmModalEdit('${c.id}')" class="pill-btn" style="flex:1;min-width:60px;">✎ Edit</button>
      <button onclick="if(confirm('Delete?'))deleteLead('${c.id}')" class="pill-btn" style="color:#B71C1C;border-color:#FDECEA;flex-shrink:0;">🗑</button>
    </div>
    ${(() => {
      const stage = c.db === 'converted' ? 'converted' : getStageKey(c) === 'closed' ? 'closed' : 'cold';
      const closeModal = `document.getElementById('crm-modal').classList.remove('open');`;
      const btn = (label, tab) => `<button onclick="${closeModal}dropLeadOnTab('${c.id}','${tab}')" class="pill-btn" style="flex:1;min-width:120px;">${label}</button>`;
      const rows = [];
      if (stage !== 'converted') rows.push(btn('🔥 Move to Warm Leads', 'converted'));
      if (stage !== 'cold')      rows.push(btn('🌱 Move to Cold Leads', 'cold'));
      if (stage !== 'closed')    rows.push(btn('🎉 Move to Sales Closed', 'closed'));
      return rows.length ? `<div class="modal-actions" style="flex-wrap:wrap;gap:8px;">${rows.join('')}</div>` : '';
    })()}`;
}

function crmEditHTML(c) {
  const iS = 'width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:\'Inter\',sans-serif;font-size:16px;background:var(--bg);outline:none;-webkit-appearance:none;';
  const dS = 'width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:\'Inter\',sans-serif;font-size:14px;background:var(--bg);outline:none;-webkit-appearance:none;';
  const f  = (id, label, type, val) => `<div class="fg"><label>${label}</label><input id="ce-${id}" type="${type}" value="${val||''}" style="${type==='date'?dS:iS}"></div>`;

  return `
    <div class="modal-header">
      <div class="modal-title">Edit</div>
      <button class="modal-close" onclick="document.getElementById('crm-modal').classList.remove('open')">✕</button>
    </div>
    <div class="crm-section-hd">Details</div>
    ${f('name',     'Name',     'text', c.name)}
    ${f('company',  'Company',  'text', c.company)}
    ${f('location', 'Location', 'text', cleanLocation(c.location))}
    ${f('email',    'Email',    'text', c.email)}
    ${f('insta',    'Instagram','text', c.insta)}
    ${f('website',  'Website',  'text', c.website)}
    <div class="crm-section-hd">Additional</div>
    ${f('linkedin',     'LinkedIn',      'text', c.linkedin)}
    ${f('whatsapp',     'WhatsApp',      'text', c.whatsapp)}
    ${f('whatsapp2',    'WhatsApp 2',    'text', c.whatsapp2)}
    ${f('engagedFirst', 'First outreach','date', c.engagedFirst)}
    ${f('engageNext',   'Engage next',   'date', c.engageNext)}
    <button onclick="saveContactDetails('${c.id}','${c.db}')" class="ios-modal-close" style="margin-top:8px;">Save Changes</button>
    <button onclick="openCrmModal('${c.id}')" style="width:100%;margin-top:10px;padding:14px;background:transparent;border:1px solid var(--border);border-radius:100px;font-family:'Inter',sans-serif;font-size:14px;cursor:pointer;color:var(--muted);">Cancel</button>`;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────

function toggleReachedOut(id, db, btn) {
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) {
    btn.style.background = 'var(--gold)';
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--dark)';
  } else {
    btn.style.background = 'transparent';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--muted)';
  }
  const container = btn.closest('#reached-out-tags');
  const selected = Array.from(container.querySelectorAll('button.active')).map(b => b.dataset.opt);
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (lead) lead.reachedOutOn = selected;
  crmRender();
  fetch('/api/crm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateReachedOut', pageId: id, db, reachedOutOn: selected }),
  }).catch(e => dbg('reachedOut save failed: ' + e.message));
}

function addCustomReachedOut(id, db) {
  const input = document.getElementById('custom-reached-input');
  const val = input?.value?.trim();
  if (!val) return;
  input.value = '';
  const container = document.getElementById('reached-out-tags');
  if (!container || Array.from(container.querySelectorAll('button')).some(b => b.dataset.opt === val)) return;
  const btn = document.createElement('button');
  btn.className = 'reach-btn active';
  btn.dataset.opt = val;
  btn.textContent = val;
  btn.style.cssText = 'background:var(--gold);border-color:var(--gold);color:var(--dark);';
  btn.onclick = function() { toggleReachedOut(id, db, this); };
  container.appendChild(btn);
  const selected = Array.from(container.querySelectorAll('button.active')).map(b => b.dataset.opt);
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (lead) lead.reachedOutOn = selected;
  crmRender();
  fetch('/api/crm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateReachedOut', pageId: id, db, reachedOutOn: selected }),
  }).catch(e => dbg('reachedOut save failed: ' + e.message));
}

async function saveNotes(id, db, notes) {
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (lead) lead.notes = notes;
  try {
    await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: id, db, notes }),
    });
    dbg('Notes saved');
  } catch (e) { dbg('Notes save failed: ' + e.message); }
}

async function savePipelineStage(id, db, status) {
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (lead) lead.status = status;
  try {
    await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: id, db, status }),
    });
    dbg('Stage saved: ' + status);
  } catch (e) { dbg('Stage save failed: ' + e.message); }
}

async function saveContactDetails(id, db) {
  const props = {
    name:         document.getElementById('ce-name')?.value,
    company:      document.getElementById('ce-company')?.value,
    location:     document.getElementById('ce-location')?.value,
    email:        document.getElementById('ce-email')?.value,
    insta:        document.getElementById('ce-insta')?.value,
    website:      document.getElementById('ce-website')?.value,
    linkedin:     document.getElementById('ce-linkedin')?.value,
    whatsapp:     document.getElementById('ce-whatsapp')?.value,
    whatsapp2:    document.getElementById('ce-whatsapp2')?.value,
    engagedFirst: document.getElementById('ce-engagedFirst')?.value,
    engageNext:   document.getElementById('ce-engageNext')?.value,
  };
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (lead) Object.assign(lead, props);
  try {
    await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateDetails', pageId: id, db, ...props }),
    });
    dbg('Contact saved');
    openCrmModal(id);
  } catch (e) { dbg('Save failed: ' + e.message); }
}

async function promoteLead(id, skipConfirm = false) {
  const c = allLeads().find(x => x.id === id);
  if (!c || !skipConfirm && !confirm(`Move ${c.name} to Converted?`)) return;
  try {
    await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote', pageId: id, name: c.name, company: c.company,
        email: c.email, insta: c.insta, website: c.website, location: c.location, notes: c.notes }),
    });
    ['emailLeads', 'whatsappLeads', 'shalaLeads'].forEach(k => {
      if (crmData[k]) crmData[k] = crmData[k].filter(x => x.id !== id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
    dbg('Promoted: ' + c.name);
  } catch (e) { dbg('Promote failed: ' + e.message); }
}

function loadDraftFromCrm(i) {
  document.getElementById('crm-modal')?.classList.remove('open');
  if (typeof loadDraftByIndex === 'function') { loadDraftByIndex(i); switchTab('deal'); }
}

async function deleteLead(id) {
  try {
    await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', pageId: id }),
    });
    ['emailLeads', 'whatsappLeads', 'shalaLeads', 'converted'].forEach(k => {
      if (crmData[k]) crmData[k] = crmData[k].filter(x => x.id !== id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
  } catch (e) { dbg('Delete failed: ' + e.message); }
}

// ── DRAG & DROP (desktop HTML5 + mobile touch) ────────────────────────────────
let _tdId = null, _tdGhost = null, _tdTimer = null;

function startLeadDrag(event, id) {
  event.dataTransfer.setData('leadId', id);
  event.dataTransfer.effectAllowed = 'move';
}

function dropLeadOnTab(id, targetTab) {
  const lead = [...allLeads(), ...(crmData.converted || [])].find(x => x.id === id);
  if (!lead) return;
  const sourceTab = lead.db === 'converted' ? 'converted'
                  : getStageKey(lead) === 'closed' ? 'closed' : 'cold';
  if (sourceTab === targetTab) return;

  if (targetTab === 'converted' && sourceTab !== 'converted') {
    const srcKey = lead.db === 'email' ? 'emailLeads' : lead.db === 'whatsapp' ? 'whatsappLeads' : 'shalaLeads';
    if (crmData[srcKey]) crmData[srcKey] = crmData[srcKey].filter(x => x.id !== id);
    lead.db = 'converted';
    crmData.converted = [...(crmData.converted || []), lead];
    crmSwitchTab('converted');
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote', pageId: id, name: lead.name, company: lead.company,
        email: lead.email, insta: lead.insta, website: lead.website, location: lead.location, notes: lead.notes }),
    }).catch(e => dbg('Promote failed: ' + e.message));

  } else if (targetTab === 'closed' && sourceTab === 'cold') {
    const st = lead.db === 'email' ? 'SALE CLOSED' : 'Converted to Customer';
    lead.status = st;
    crmSwitchTab('closed');
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: id, db: lead.db, status: st }),
    }).catch(e => dbg('Status save failed: ' + e.message));

  } else if (targetTab === 'cold' && sourceTab === 'converted') {
    crmData.converted = (crmData.converted || []).filter(x => x.id !== id);
    lead.db = 'email';
    lead.status = null;
    crmData.emailLeads = [...(crmData.emailLeads || []), lead];
    crmSwitchTab('cold');
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demote', pageId: id, name: lead.name, company: lead.company,
        email: lead.email, insta: lead.insta, website: lead.website, location: lead.location, notes: lead.notes }),
    }).catch(e => dbg('Demote failed: ' + e.message));

  } else if (targetTab === 'cold' && sourceTab === 'closed') {
    lead.status = 'Followed + Engaged';
    crmSwitchTab('cold');
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: id, db: lead.db, status: 'Followed + Engaged' }),
    }).catch(e => dbg('Status save failed: ' + e.message));
  }
}

async function demoteLead(id) {
  const c = (crmData.converted || []).find(x => x.id === id);
  if (!c) return;
  try {
    const r = await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demote', pageId: id, name: c.name, company: c.company,
        email: c.email, insta: c.insta, website: c.website, location: c.location, notes: c.notes }),
    });
    if (!r.ok) throw new Error(await r.text());
    crmData.converted = (crmData.converted || []).filter(x => x.id !== id);
    document.getElementById('crm-modal').classList.remove('open');
    crmSwitchTab('cold');
    dbg('Demoted: ' + c.name);
  } catch (e) { dbg('Demote failed: ' + e.message); }
}

function initCrmDragDrop() {
  const TAB_MAP = { 'crm-tab-cold': 'cold', 'crm-tab-converted': 'converted', 'crm-tab-closed': 'closed' };

  // ── Desktop: HTML5 drag onto tab buttons ──
  Object.entries(TAB_MAP).forEach(([elId, tab]) => {
    const el = document.getElementById(elId);
    if (!el || el._dragInited) return;
    el._dragInited = true;
    el.addEventListener('dragover',  e => { e.preventDefault(); el.style.outline = '2px solid var(--gold)'; el.style.outlineOffset = '2px'; });
    el.addEventListener('dragleave', () => { el.style.outline = ''; el.style.outlineOffset = ''; });
    el.addEventListener('drop', e => {
      e.preventDefault(); el.style.outline = ''; el.style.outlineOffset = '';
      const id = e.dataTransfer.getData('leadId');
      if (id) dropLeadOnTab(id, tab);
    });
    // Mobile: tap tab while a lead is selected (touchstart fires reliably; click may not after long-press)
    el.addEventListener('touchstart', e => {
      if (!_moveLeadId) return;
      e.stopPropagation(); // prevent document cancel handler
      const id = _moveLeadId;
      clearMoveSelection();
      dropLeadOnTab(id, tab);
    }, { passive: true });
  });

  // ── Mobile: long-press card (500ms) → card selected → tap tab to move ──
  const list = document.getElementById('crm-list');
  if (!list || list._touchInited) return;
  list._touchInited = true;

  let _lpTimer = null, _lpStartX = 0, _lpStartY = 0;

  list.addEventListener('touchstart', e => {
    const card = e.target.closest('[data-lead-id]');
    if (!card) return;
    const id = card.dataset.leadId;
    _lpStartX = e.touches[0].clientX;
    _lpStartY = e.touches[0].clientY;
    _lpTimer = setTimeout(() => { _lpTimer = null; setMoveSelection(id); }, 500);
  }, { passive: true });

  list.addEventListener('touchmove', e => {
    if (!_lpTimer) return;
    const dx = Math.abs(e.touches[0].clientX - _lpStartX);
    const dy = Math.abs(e.touches[0].clientY - _lpStartY);
    if (dx > 10 || dy > 10) { clearTimeout(_lpTimer); _lpTimer = null; }
  }, { passive: true });
  list.addEventListener('touchend',    () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
  list.addEventListener('touchcancel', () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });

  // Tap anywhere outside tab buttons cancels selection
  document.addEventListener('touchstart', e => {
    if (!_moveLeadId) return;
    if (!e.target.closest('[id^="crm-tab-"]')) clearMoveSelection();
  }, { passive: true });
}

// ── DUPLICATES ────────────────────────────────────────────────────────────────
function findDuplicates() {
  const groups = {};
  [...allLeads(), ...(crmData.converted || [])].forEach(c => {
    const key = (c.name || '').toLowerCase().trim();
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return Object.values(groups).filter(g => g.length > 1);
}

function showDuplicates() {
  const dups = findDuplicates();
  const list = document.getElementById('crm-list');
  if (!dups.length) { list.innerHTML = '<div class="crm-empty">No duplicates ✓</div>'; return; }
  list.innerHTML = dups.map(group => `
    <div style="background:var(--surface);border:1px solid #FDECEA;border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:#B71C1C;margin-bottom:10px;">DUPLICATE: ${group[0].name}</div>
      ${group.map((c, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:13px;font-weight:500;">${c.name} <span style="font-size:10px;color:var(--muted);">(${c.db})</span></div>
          <div style="font-size:11px;color:var(--muted);">${cleanLocation(c.location)||'—'}</div>
        </div>
        ${i > 0 ? `<button onclick="deleteDupConfirm('${c.id}','${c.name}')" style="padding:5px 14px;border-radius:100px;border:1px solid #FDECEA;background:transparent;color:#B71C1C;font-size:11px;font-weight:700;cursor:pointer;">Delete</button>` : '<span style="font-size:11px;color:#2E7D32;font-weight:600;">Keep</span>'}
      </div>`).join('')}
    </div>`).join('');
}

async function deleteDupConfirm(id, name) {
  if (!confirm(`Delete: ${name}?`)) return;
  try {
    await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', pageId: id }) });
    ['emailLeads', 'whatsappLeads', 'shalaLeads', 'converted'].forEach(k => { if (crmData[k]) crmData[k] = crmData[k].filter(x => x.id !== id); });
    showDuplicates();
  } catch (e) { dbg('Delete dup failed: ' + e.message); }
}

// ── NEW LEAD ──────────────────────────────────────────────────────────────────
function openNewLeadModal() {
  ['nl-name', 'nl-company', 'nl-email', 'nl-insta', 'nl-whatsapp', 'nl-location', 'nl-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const dbSel = document.getElementById('nl-db');
  if (dbSel) dbSel.value = crmTab === 'shala' ? 'shala' : 'email';
  document.getElementById('new-lead-modal').classList.add('open');
}

function closeNewLeadModal(e) {
  if (!e || e.target === document.getElementById('new-lead-modal'))
    document.getElementById('new-lead-modal').classList.remove('open');
}

async function saveNewLead() {
  const name = document.getElementById('nl-name')?.value;
  if (!name) { alert('Name is required'); return; }
  const db = document.getElementById('nl-db')?.value || 'email';
  try {
    const r = await fetch('/api/crm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create', db, name,
        company:  document.getElementById('nl-company')?.value,
        email:    document.getElementById('nl-email')?.value,
        insta:    document.getElementById('nl-insta')?.value,
        whatsapp: document.getElementById('nl-whatsapp')?.value,
        location: document.getElementById('nl-location')?.value,
        notes:    document.getElementById('nl-notes')?.value,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    document.getElementById('new-lead-modal').classList.remove('open');
    loadCRM(true);
  } catch (e) { dbg('Create failed: ' + e.message); alert('Could not save: ' + e.message); }
}
