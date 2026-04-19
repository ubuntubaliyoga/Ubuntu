// js/crm.js

// ── STATE ─────────────────────────────────────────────────────────────────────
let crmTab = 'cold'; // cold | converted | closed | shala
let crmCollapsed = {};
let crmLoaded = false;
let dragItemId = null;

const REACHED_OUT_OPTIONS = ['Email', 'Instagram', 'LinkedIn', 'WhatsApp', 'In Person', 'Cold Call'];

// Stage definitions for pipeline
const COLD_STATUSES    = ['Followed + Engaged', 'Reached out', '', null, undefined];
const WARM_STATUSES    = ['WARM: Booked a call OR asked for help', 'HOT: Past client/strong conversation', 'QUALIFIED TO BUY', 'Booked a call', 'Sent an offer'];
const CLOSED_STATUSES  = ['SALE CLOSED', 'Converted to Customer'];
const DEAD_STATUSES    = ['GHOSTED', 'TERMINATED', 'NOT GOOD FIT'];

// Source badge colours
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
  if (CLOSED_STATUSES.includes(s))  return 'closed';
  if (WARM_STATUSES.includes(s))    return 'warm';
  if (DEAD_STATUSES.includes(s))    return 'dead';
  return 'cold';
}

function cleanLocation(loc) {
  if (!loc) return '—';
  if (loc.includes('maps.google.com') || loc.startsWith('http')) {
    const m = loc.match(/[?&]q=([^&]+)/);
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ');
    return '—';
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

// ── TAB ───────────────────────────────────────────────────────────────────────
function crmSwitchTab(tab) {
  crmTab = tab;
  ['cold','converted','closed','shala'].forEach(t => {
    document.getElementById('crm-tab-' + t)?.classList.toggle('active', t === tab);
  });
  crmRender();
}

// ── ITEMS FOR CURRENT TAB ─────────────────────────────────────────────────────
function tabItems() {
  if (crmTab === 'shala')     return crmData.shalaLeads || [];
  if (crmTab === 'converted') return crmData.converted  || [];
  if (crmTab === 'closed')    return allLeads().filter(c => getStageKey(c) === 'closed');
  // cold = all non-shala leads that are not closed
  return allLeads().filter(c => {
    const stage = getStageKey(c);
    return stage === 'cold' || stage === 'warm' || stage === 'dead';
  });
}

// ── SORT ──────────────────────────────────────────────────────────────────────
function crmSort(items) {
  const g = document.getElementById('crm-group')?.value || 'date';
  if (g === 'name')     return [...items].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  if (g === 'location') return [...items].sort((a,b) => cleanLocation(a.location).localeCompare(cleanLocation(b.location)));
  return [...items].sort((a,b) => new Date(b.lastEdited||0) - new Date(a.lastEdited||0));
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const search = (document.getElementById('crm-search')?.value || '').toLowerCase();
  let items = tabItems().filter(c =>
    !search || ((c.name||'') + (c.location||'') + (c.company||'')).toLowerCase().includes(search)
  );

  const countEl = document.getElementById('crm-count');
  if (countEl) countEl.textContent = `${items.length} of ${tabItems().length}`;

  items = crmSort(items);
  list.innerHTML = items.length ? buildList(items) : '<div class="crm-empty">No leads found.</div>';
}

// ── CARD LIST (mobile-first, one column) ──────────────────────────────────────
function buildList(items) {
  return items.map(c => {
    const src = SRC_CFG[c.db] || SRC_CFG.email;
    const reached = c.reachedOutOn || [];
    const stage = getStageKey(c);
    const stageBadge = stage === 'warm'
      ? `<span class="crm-badge" style="background:#E3F2FD;color:#1565C0;">🔥 Warm</span>`
      : stage === 'closed'
      ? `<span class="crm-badge" style="background:#E8F5E9;color:#2E7D32;">🎉 Closed</span>`
      : stage === 'dead'
      ? `<span class="crm-badge" style="background:#F0EBE3;color:#8B7355;">👻 Dead</span>`
      : '';

    return `<div class="crm-card" onclick="openCrmModal('${c.id}')">
      <div class="crm-card-main">
        <div class="crm-card-name">${c.name || 'Unnamed'}</div>
        <div class="crm-card-loc">${cleanLocation(c.location)}</div>
      </div>
      <div class="crm-card-badges">
        <span class="crm-badge" style="background:${src.bg};color:${src.color};">${src.label}</span>
        ${stageBadge}
        ${reached.slice(0,2).map(r => `<span class="crm-badge" style="background:var(--bg2);color:var(--muted);">${r}</span>`).join('')}
      </div>
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
  const c = [...allLeads(), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function openCrmModalEdit(id) {
  const c = [...allLeads(), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmEditHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function closeCrmModal(e) {
  if (!e || e.target === document.getElementById('crm-modal'))
    document.getElementById('crm-modal').classList.remove('open');
}

function crmDetailHTML(c) {
  const src = SRC_CFG[c.db] || SRC_CFG.email;
  const reached = c.reachedOutOn || [];
  const isLead = c.db !== 'converted';

  // Status options
  const emailStatuses = ['Followed + Engaged','Reached out','WARM: Booked a call OR asked for help','HOT: Past client/strong conversation','QUALIFIED TO BUY','SALE CLOSED','GHOSTED','TERMINATED','NOT GOOD FIT'];
  const waStatuses    = ['Booked a call','Sent an offer','Converted to Customer'];
  const convStatuses  = ['Face2Face conversation','Responded','Phone call','Booked Venue','Rejected Ubuntu'];

  let statusBlock = '';
  if (c.db === 'email') {
    statusBlock = `<div class="crm-section-hd">Pipeline Stage</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${emailStatuses.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'whatsapp') {
    statusBlock = `<div class="crm-section-hd">Status</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${waStatuses.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'converted') {
    statusBlock = `<div class="crm-section-hd">Status</div>
      <select class="crm-select" multiple size="3" onchange="savePipelineStage('${c.id}','${c.db}',Array.from(this.selectedOptions).map(o=>o.value))">
        ${convStatuses.map(s=>`<option value="${s}"${(Array.isArray(c.status)?c.status:[c.status]).includes(s)?' selected':''}>${s}</option>`).join('')}
      </select>`;
  }

  const fields = [
    c.company   && ['Company',   c.company],
    c.email     && ['Email',     `<a href="mailto:${c.email}" style="color:var(--gold);">${c.email}</a>`],
    c.insta     && ['Instagram', c.insta],
    c.website   && ['Website',   `<a href="${c.website}" target="_blank" style="color:var(--gold);">${c.website}</a>`],
    c.linkedin  && ['LinkedIn',  c.linkedin],
    c.whatsapp  && ['WhatsApp',  c.whatsapp],
    c.whatsapp2 && ['WhatsApp 2',c.whatsapp2],
    c.engagedFirst && ['First contact', c.engagedFirst],
    c.engagedLast  && ['Last contact',  fmtD(c.engagedLast)],
    c.engageNext   && ['Engage next',   fmtD(c.engageNext)],
    c.suitability  && ['Suitability',   `<span class="crm-badge ${suitClass(c.suitability)}">${c.suitability}</span>`],
  ].filter(Boolean);

  return `
    <div class="modal-header">
      <div>
        <div class="modal-title">${c.name || 'Unnamed'}</div>
        <div class="modal-sub">${cleanLocation(c.location)}</div>
      </div>
      <button class="modal-close" onclick="closeCrmModal()">✕</button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
      <span class="crm-badge" style="background:${src.bg};color:${src.color};">${src.label}</span>
    </div>

    <div class="crm-section-hd">Reached Out On</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;" id="reached-out-tags">
      ${REACHED_OUT_OPTIONS.map(opt => {
        const active = reached.includes(opt);
        return `<button class="reach-btn${active?' active':''}" data-opt="${opt}"
          onclick="toggleReachedOut('${c.id}','${c.db}','${opt}',this)">${opt}</button>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-bottom:16px;">
      <input id="custom-reached-input" type="text" placeholder="+ Custom…"
        style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;min-width:0;">
      <button onclick="addCustomReachedOut('${c.id}','${c.db}')"
        style="padding:8px 14px;border-radius:100px;border:1px solid var(--border);background:transparent;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;color:var(--muted);white-space:nowrap;">Add</button>
    </div>

    ${statusBlock}

    ${fields.length ? `<div class="crm-section-hd">Info</div>
      ${fields.map(([label,val])=>`<div class="crm-field"><div class="crm-field-label">${label}</div><div style="font-size:13px;flex:1;">${val}</div></div>`).join('')}` : ''}

    ${c.notes ? `<div class="crm-section-hd">Notes</div><div style="font-size:13px;line-height:1.7;color:var(--text);">${c.notes}</div>` : ''}

    <div class="modal-actions">
      <button onclick="openCrmModalEdit('${c.id}')" class="pill-btn" style="flex:1;">✎ Edit</button>
      ${isLead ? `<button onclick="promoteLead('${c.id}')" class="pill-btn dark" style="flex:1;">→ Convert</button>` : ''}
      <button onclick="if(confirm('Delete?'))deleteLead('${c.id}')" class="pill-btn" style="color:#B71C1C;border-color:#FDECEA;flex-shrink:0;">🗑</button>
    </div>`;
}

function crmEditHTML(c) {
  return `
    <div class="modal-header">
      <div class="modal-title">Edit</div>
      <button class="modal-close" onclick="closeCrmModal()">✕</button>
    </div>
    <div class="crm-section-hd">Details</div>
    ${['name','company','location','email','insta','website'].map(f => `
      <div class="fg"><label>${f.charAt(0).toUpperCase()+f.slice(1)}</label>
        <input id="ce-${f}" type="text" value="${(f==='location'?cleanLocation(c.location):c[f])||''}"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:16px;background:var(--bg);outline:none;">
      </div>`).join('')}
    ${c.db==='email'?`<div class="fg"><label>Notes</label>
      <textarea id="ce-notes" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:16px;background:var(--bg);outline:none;resize:vertical;">${c.notes||''}</textarea>
    </div>`:''}
    <button onclick="saveContactDetails('${c.id}','${c.db}')" class="ios-modal-close" style="margin-top:8px;">Save Changes</button>
    <button onclick="openCrmModal('${c.id}')" style="width:100%;margin-top:8px;padding:12px;background:transparent;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;color:var(--muted);">Cancel</button>`;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function toggleReachedOut(id, db, opt, btn) {
  const isActive = btn.classList.contains('active');
  btn.classList.toggle('active', !isActive);
  const container = btn.closest('#reached-out-tags');
  const selected = Array.from(container.querySelectorAll('button.active')).map(b => b.dataset.opt);
  const lead = [...allLeads(),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) lead.reachedOutOn = selected;
  fetch('/api/crm', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'updateReachedOut', pageId:id, db, reachedOutOn:selected}),
  }).catch(e => dbg('reachedOut save failed: '+e.message));
}

function addCustomReachedOut(id, db) {
  const input = document.getElementById('custom-reached-input');
  const val = input?.value?.trim();
  if (!val) return;
  input.value = '';
  const container = document.getElementById('reached-out-tags');
  if (!container) return;
  if (Array.from(container.querySelectorAll('button')).some(b => b.dataset.opt === val)) return;
  const btn = document.createElement('button');
  btn.className = 'reach-btn active';
  btn.dataset.opt = val;
  btn.textContent = val;
  btn.onclick = function() { toggleReachedOut(id, db, val, this); };
  container.appendChild(btn);
  const selected = Array.from(container.querySelectorAll('button.active')).map(b => b.dataset.opt);
  const lead = [...allLeads(),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) lead.reachedOutOn = selected;
  fetch('/api/crm', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'updateReachedOut', pageId:id, db, reachedOutOn:selected}),
  }).catch(e => dbg('reachedOut save failed: '+e.message));
}

async function savePipelineStage(id, db, status) {
  const lead = [...allLeads(),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) lead.status = status;
  try {
    await fetch('/api/crm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'update', pageId:id, db, status}),
    });
    dbg('Stage saved: '+status);
  } catch(e) { dbg('Stage save failed: '+e.message); }
}

async function saveContactDetails(id, db) {
  const props = {
    name:     document.getElementById('ce-name')?.value,
    company:  document.getElementById('ce-company')?.value,
    location: document.getElementById('ce-location')?.value,
    email:    document.getElementById('ce-email')?.value,
    insta:    document.getElementById('ce-insta')?.value,
    website:  document.getElementById('ce-website')?.value,
    notes:    document.getElementById('ce-notes')?.value,
  };
  const lead = [...allLeads(),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) Object.assign(lead, props);
  try {
    await fetch('/api/crm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'updateDetails', pageId:id, db, ...props}),
    });
    dbg('Contact saved');
    openCrmModal(id);
  } catch(e) { dbg('Save failed: '+e.message); }
}

async function promoteLead(id) {
  const c = allLeads().find(x=>x.id===id);
  if (!c || !confirm(`Move ${c.name} to Converted?`)) return;
  try {
    await fetch('/api/crm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'promote', pageId:id, name:c.name, company:c.company,
        email:c.email, insta:c.insta, website:c.website, location:c.location, notes:c.notes}),
    });
    ['emailLeads','whatsappLeads','shalaLeads'].forEach(k => {
      if (crmData[k]) crmData[k] = crmData[k].filter(x=>x.id!==id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
    dbg('Promoted: '+c.name);
  } catch(e) { dbg('Promote failed: '+e.message); }
}

async function deleteLead(id) {
  try {
    await fetch('/api/crm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'delete', pageId:id}),
    });
    ['emailLeads','whatsappLeads','shalaLeads','converted'].forEach(k => {
      if (crmData[k]) crmData[k] = crmData[k].filter(x=>x.id!==id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
  } catch(e) { dbg('Delete failed: '+e.message); }
}

// ── DUPLICATES ────────────────────────────────────────────────────────────────
function findDuplicates() {
  const groups = {};
  [...allLeads(),...(crmData.converted||[])].forEach(c => {
    const key = (c.name||'').toLowerCase().trim();
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return Object.values(groups).filter(g=>g.length>1);
}

function showDuplicates() {
  const dups = findDuplicates();
  const list = document.getElementById('crm-list');
  if (!dups.length) { list.innerHTML='<div class="crm-empty">No duplicates ✓</div>'; return; }
  list.innerHTML = dups.map(group=>`
    <div style="background:var(--surface);border:1px solid #FDECEA;border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:#B71C1C;margin-bottom:10px;">DUPLICATE: ${group[0].name}</div>
      ${group.map((c,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:13px;font-weight:500;">${c.name} <span style="font-size:10px;color:var(--muted);">(${c.db})</span></div>
          <div style="font-size:11px;color:var(--muted);">${cleanLocation(c.location)}</div>
        </div>
        ${i>0?`<button onclick="deleteDupConfirm('${c.id}','${c.name}')" style="padding:5px 14px;border-radius:100px;border:1px solid #FDECEA;background:transparent;color:#B71C1C;font-size:11px;font-weight:700;cursor:pointer;">Delete</button>`:'<span style="font-size:11px;color:#2E7D32;font-weight:600;">Keep</span>'}
      </div>`).join('')}
    </div>`).join('');
}

async function deleteDupConfirm(id, name) {
  if (!confirm(`Delete: ${name}?`)) return;
  try {
    await fetch('/api/crm', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',pageId:id})});
    ['emailLeads','whatsappLeads','shalaLeads','converted'].forEach(k=>{if(crmData[k])crmData[k]=crmData[k].filter(x=>x.id!==id);});
    showDuplicates();
  } catch(e) { dbg('Delete dup failed: '+e.message); }
}

// ── NEW LEAD ──────────────────────────────────────────────────────────────────
function openNewLeadModal() {
  ['nl-name','nl-company','nl-email','nl-insta','nl-whatsapp','nl-location','nl-notes'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  const dbSel = document.getElementById('nl-db');
  if (dbSel) dbSel.value = crmTab === 'shala' ? 'shala' : 'email';
  document.getElementById('new-lead-modal').classList.add('open');
}

function closeNewLeadModal(e) {
  if (!e || e.target===document.getElementById('new-lead-modal'))
    document.getElementById('new-lead-modal').classList.remove('open');
}

async function saveNewLead() {
  const name = document.getElementById('nl-name')?.value;
  if (!name) { alert('Name is required'); return; }
  const db = document.getElementById('nl-db')?.value || 'email';
  try {
    const r = await fetch('/api/crm', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:'create', db, name,
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
  } catch(e) { dbg('Create failed: '+e.message); alert('Could not save: '+e.message); }
}
