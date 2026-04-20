// js/crm.js

// ── STATE ─────────────────────────────────────────────────────────────────────
let crmData = { emailLeads: [], whatsappLeads: [], shalaLeads: [], converted: [] };
let crmTab = 'cold';
let crmCollapsed = {};
let crmLoaded = false;

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
  crmTab = tab;
  ['cold', 'converted', 'closed', 'shala'].forEach(t => {
    document.getElementById('crm-tab-' + t)?.classList.toggle('active', t === tab);
  });
  crmRender();
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
function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const search = (document.getElementById('crm-search')?.value || '').toLowerCase();
  let items = tabItems().filter(c =>
    !search || ((c.name || '') + (c.location || '') + (c.company || '')).toLowerCase().includes(search)
  );

  const countEl = document.getElementById('crm-count');
  if (countEl) countEl.textContent = `${items.length} of ${tabItems().length}`;

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

    return `<div class="crm-card" onclick="openCrmModal('${c.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div style="min-width:0;">
          <div class="crm-card-name">${c.name || 'Unnamed'}</div>
          ${metaParts.length ? `<div class="crm-card-meta">${metaParts.join('<span style="margin:0 4px;opacity:.4;">·</span>')}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span class="crm-badge" style="background:${src.bg};color:${src.color};">${src.label}</span>
          ${stageBadge}
        </div>
      </div>
      ${reachedChips ? `<div class="crm-card-badges" style="margin-top:6px;">${reachedChips}</div>` : ''}
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
    crmRender();
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

  const emailStatuses = ['Followed + Engaged','Reached out','WARM: Booked a call OR asked for help','HOT: Past client/strong conversation','QUALIFIED TO BUY','SALE CLOSED','GHOSTED','TERMINATED','NOT GOOD FIT'];
  const waStatuses    = ['Booked a call','Sent an offer','Converted to Customer'];
  const convStatuses  = ['Face2Face conversation','Responded','Phone call','Booked Venue','Rejected Ubuntu'];

  let statusBlock = '';
  if (c.db === 'email') {
    statusBlock = `<div class="crm-section-hd">Pipeline Stage</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${emailStatuses.map(s => `<option value="${s}"${c.status === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'whatsapp') {
    statusBlock = `<div class="crm-section-hd">Status</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${waStatuses.map(s => `<option value="${s}"${c.status === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'converted') {
    statusBlock = `<div class="crm-section-hd">Status</div>
      <select class="crm-select" multiple size="3" onchange="savePipelineStage('${c.id}','${c.db}',Array.from(this.selectedOptions).map(o=>o.value))">
        ${convStatuses.map(s => `<option value="${s}"${(Array.isArray(c.status)?c.status:[c.status]).includes(s)?' selected':''}>${s}</option>`).join('')}
      </select>`;
  }

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
    c.suitability  && ['Suitability',    `<span class="crm-badge ${suitClass(c.suitability)}">${c.suitability}</span>`],
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
        style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:16px;background:var(--bg);outline:none;min-width:0;-webkit-appearance:none;">
      <button onclick="addCustomReachedOut('${c.id}','${c.db}')"
        style="padding:9px 16px;border-radius:100px;border:1px solid var(--border);background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);white-space:nowrap;flex-shrink:0;">Add</button>
    </div>

    ${statusBlock}

    ${c.notes !== null && c.notes !== undefined ? `
      <div class="crm-section-hd">Notes</div>
      <textarea id="notes-editor-${c.id}"
        onchange="saveNotes('${c.id}','${c.db}',this.value)"
        onblur="saveNotes('${c.id}','${c.db}',this.value)"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;resize:vertical;min-height:70px;line-height:1.6;"
      >${c.notes}</textarea>` : isLead && c.db === 'email' ? `
      <div class="crm-section-hd">Notes</div>
      <textarea id="notes-editor-${c.id}"
        onchange="saveNotes('${c.id}','${c.db}',this.value)"
        onblur="saveNotes('${c.id}','${c.db}',this.value)"
        placeholder="Add notes…"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;resize:vertical;min-height:70px;line-height:1.6;"
      ></textarea>` : ''}

    ${fields.length ? `<div class="crm-section-hd">Info</div>
      ${fields.map(([label, val]) => `<div class="crm-field"><div class="crm-field-label">${label}</div><div style="font-size:13px;flex:1;word-break:break-word;">${val}</div></div>`).join('')}` : ''}

    <div class="modal-actions">
      <button onclick="openCrmModalEdit('${c.id}')" class="pill-btn" style="flex:1;">✎ Edit</button>
      ${isLead ? `<button onclick="promoteLead('${c.id}')" class="pill-btn dark" style="flex:1;">→ Convert</button>` : ''}
      <button onclick="if(confirm('Delete?'))deleteLead('${c.id}')" class="pill-btn" style="color:#B71C1C;border-color:#FDECEA;flex-shrink:0;">🗑</button>
    </div>`;
}

function crmEditHTML(c) {
  const inputStyle = 'width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:\'DM Sans\',sans-serif;font-size:16px;background:var(--bg);outline:none;-webkit-appearance:none;';
  const dateStyle  = 'width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:\'DM Sans\',sans-serif;font-size:14px;background:var(--bg);outline:none;-webkit-appearance:none;';

  const baseFields = ['name','company','location','email','insta','website'];

  let extraFields = '';
  if (c.db === 'email') {
    extraFields = `
      <div class="crm-section-hd">Additional</div>
      <div class="fg"><label>LinkedIn</label>
        <input id="ce-linkedin" type="text" value="${c.linkedin||''}" style="${inputStyle}">
      </div>
      <div class="fg"><label>First outreach</label>
        <input id="ce-engagedFirst" type="date" value="${c.engagedFirst||''}" style="${dateStyle}">
      </div>
      <div class="fg"><label>Engage next</label>
        <input id="ce-engageNext" type="date" value="${c.engageNext||''}" style="${dateStyle}">
      </div>
      <div class="fg"><label>Suitability</label>
        <input id="ce-suitability" type="text" value="${c.suitability||''}" style="${inputStyle}">
      </div>`;
  } else if (c.db === 'whatsapp') {
    extraFields = `
      <div class="crm-section-hd">Additional</div>
      <div class="fg"><label>WhatsApp 1</label>
        <input id="ce-whatsapp" type="text" value="${c.whatsapp||''}" style="${inputStyle}">
      </div>
      <div class="fg"><label>WhatsApp 2</label>
        <input id="ce-whatsapp2" type="text" value="${c.whatsapp2||''}" style="${inputStyle}">
      </div>
      <div class="fg"><label>Engage next</label>
        <input id="ce-engageNext" type="date" value="${c.engageNext||''}" style="${dateStyle}">
      </div>
      <div class="fg"><label>Suitability</label>
        <input id="ce-suitability" type="text" value="${c.suitability||''}" style="${inputStyle}">
      </div>`;
  } else {
    extraFields = `
      <div class="crm-section-hd">Additional</div>
      <div class="fg"><label>WhatsApp</label>
        <input id="ce-whatsapp" type="text" value="${c.whatsapp||''}" style="${inputStyle}">
      </div>
      <div class="fg"><label>Engage next</label>
        <input id="ce-engageNext" type="date" value="${c.engageNext||''}" style="${dateStyle}">
      </div>
      <div class="fg"><label>Suitability</label>
        <input id="ce-suitability" type="text" value="${c.suitability||''}" style="${inputStyle}">
      </div>`;
  }

  return `
    <div class="modal-header">
      <div class="modal-title">Edit</div>
      <button class="modal-close" onclick="document.getElementById('crm-modal').classList.remove('open')">✕</button>
    </div>
    <div class="crm-section-hd">Details</div>
    ${baseFields.map(f => `
      <div class="fg"><label>${f.charAt(0).toUpperCase()+f.slice(1)}</label>
        <input id="ce-${f}" type="text" value="${(f === 'location' ? (cleanLocation(c.location)||'') : (c[f]||''))}"
          style="${inputStyle}">
      </div>`).join('')}
    ${extraFields}
    ${(c.db === 'email' || c.db === 'converted') ? `<div class="fg"><label>Notes</label>
      <textarea id="ce-notes" rows="3" style="width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:16px;background:var(--bg);outline:none;resize:vertical;">${c.notes||''}</textarea>
    </div>` : ''}
    <button onclick="saveContactDetails('${c.id}','${c.db}')" class="ios-modal-close" style="margin-top:8px;">Save Changes</button>
    <button onclick="openCrmModal('${c.id}')" style="width:100%;margin-top:10px;padding:14px;background:transparent;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;color:var(--muted);">Cancel</button>`;
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
    notes:        document.getElementById('ce-notes')?.value,
    linkedin:     document.getElementById('ce-linkedin')?.value,
    whatsapp:     document.getElementById('ce-whatsapp')?.value,
    whatsapp2:    document.getElementById('ce-whatsapp2')?.value,
    engagedFirst: document.getElementById('ce-engagedFirst')?.value,
    engageNext:   document.getElementById('ce-engageNext')?.value,
    suitability:  document.getElementById('ce-suitability')?.value,
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

async function promoteLead(id) {
  const c = allLeads().find(x => x.id === id);
  if (!c || !confirm(`Move ${c.name} to Converted?`)) return;
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
