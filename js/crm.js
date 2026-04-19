// js/crm.js

// ── STATE ─────────────────────────────────────────────────────────────────────
let crmView = 'list'; // 'list' | 'pipeline'
let crmCollapsed = {};
let dragItemId = null;

// Tabs: email | whatsapp | shala | converted
let crmTab = 'email';

const REACHED_OUT_OPTIONS = ['Email', 'Instagram', 'LinkedIn', 'WhatsApp', 'In Person', 'Cold Call'];

const PIPELINE_STATUSES_EMAIL = [
  'Followed + Engaged', 'Reached out',
  'WARM: Booked a call OR asked for help',
  'HOT: Past client/strong conversation',
  'QUALIFIED TO BUY', 'SALE CLOSED', 'GHOSTED', 'TERMINATED', 'NOT GOOD FIT',
];

const PIPELINE_STATUSES_WHATSAPP = [
  'Booked a call', 'Sent an offer', 'Converted to Customer',
];

const STAGES = [
  { key: 'cold',   label: '🌱 Cold Lead',      color: '#8B7355', bg: '#F5ECD7', border: '#D4B483',
    statuses: ['Followed + Engaged', 'Reached out', null, undefined, ''] },
  { key: 'warm',   label: '🤝 Warm Lead',       color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9',
    statuses: ['WARM: Booked a call OR asked for help', 'HOT: Past client/strong conversation', 'QUALIFIED TO BUY', 'Booked a call', 'Sent an offer'] },
  { key: 'closed', label: '🎉 Sale Closed',     color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7',
    statuses: ['SALE CLOSED', 'Converted to Customer'] },
];
const DEAD_STATUSES = ['GHOSTED', 'TERMINATED', 'NOT GOOD FIT'];

// Source display config
const SRC_CFG = {
  email:     { label: '📧 Email',     color: '#1565C0', bg: '#E3F2FD' },
  whatsapp:  { label: '💬 WhatsApp',  color: '#2E7D32', bg: '#E8F5E9' },
  shala:     { label: '🏛 Shala',     color: '#E65100', bg: '#FFF3E0' },
  converted: { label: '⭐ Converted', color: '#5C3D2E', bg: '#F5ECD7' },
};

function getStage(c) {
  const s = Array.isArray(c.status) ? c.status[0] : c.status;
  for (const stage of STAGES) {
    if (stage.statuses.includes(s)) return stage.key;
  }
  if (DEAD_STATUSES.includes(s)) return 'dead';
  return 'cold';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
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
  if (s.startsWith('4')) return 'crm-suit-4';
  return '';
}

function allLeads() {
  return [
    ...(crmData.emailLeads    || []),
    ...(crmData.whatsappLeads || []),
    ...(crmData.shalaLeads    || []),
    ...(crmData.converted     || []),
  ];
}

function currentItems() {
  if (crmTab === 'email')     return crmData.emailLeads    || [];
  if (crmTab === 'whatsapp')  return crmData.whatsappLeads || [];
  if (crmTab === 'shala')     return crmData.shalaLeads    || [];
  if (crmTab === 'converted') return crmData.converted     || [];
  return [];
}

// ── TAB / VIEW ────────────────────────────────────────────────────────────────
function crmSwitchTab(tab) {
  crmTab = tab;
  ['email', 'whatsapp', 'shala', 'converted'].forEach(t => {
    document.getElementById('crm-tab-' + t)?.classList.toggle('active', t === tab);
  });
  // pipeline only available for lead tabs, not converted or shala
  const pipelineBtn = document.getElementById('crm-view-pipeline');
  if (pipelineBtn) {
    pipelineBtn.style.display = (tab === 'converted' || tab === 'shala') ? 'none' : '';
  }
  if ((tab === 'converted' || tab === 'shala') && crmView === 'pipeline') {
    setCrmView('list');
    return;
  }
  crmRender();
}

function setCrmView(view) {
  crmView = view;
  document.getElementById('crm-view-list')?.classList.toggle('active', view === 'list');
  document.getElementById('crm-view-pipeline')?.classList.toggle('active', view === 'pipeline');
  crmRender();
}

// ── SORT ──────────────────────────────────────────────────────────────────────
function crmSort(items) {
  const g = document.getElementById('crm-group')?.value || 'none';
  if (g === 'none_name')     return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (g === 'none_location') return [...items].sort((a, b) => cleanLocation(a.location).localeCompare(cleanLocation(b.location)));
  return [...items].sort((a, b) => new Date(b.lastEdited || 0) - new Date(a.lastEdited || 0));
}

function groupKey(c, groupBy) {
  if (groupBy === 'location') return cleanLocation(c.location) || 'No Location';
  if (groupBy === 'status') {
    const s = Array.isArray(c.status) ? c.status[0] : c.status;
    return s || 'No Status';
  }
  if (groupBy === 'date') {
    const d = c.lastEdited ? new Date(c.lastEdited) : null;
    return d ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown';
  }
  return '';
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const search  = (document.getElementById('crm-search')?.value || '').toLowerCase();
  const groupBy = (document.getElementById('crm-group')?.value || 'none')
    .replace('none_name', 'none').replace('none_location', 'none');
  const realGroup = document.getElementById('crm-group')?.value || 'none';

  let items = currentItems().filter(c => {
    if (!search) return true;
    return ((c.name || '') + (c.location || '') + (c.company || '')).toLowerCase().includes(search);
  });

  const countEl = document.getElementById('crm-count');
  if (countEl) countEl.textContent = `${items.length} of ${currentItems().length}`;

  if (crmView === 'pipeline' && (crmTab === 'email' || crmTab === 'whatsapp')) {
    renderPipeline(items);
    return;
  }

  items = crmSort(items);

  const needsGroup = ['location', 'status', 'date'].some(k => realGroup.startsWith(k));
  if (needsGroup) {
    const groups = {};
    items.forEach(c => {
      const k = groupKey(c, realGroup);
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    });
    list.innerHTML = Object.entries(groups).map(([key, grpItems]) => {
      const collapsed = crmCollapsed[key];
      return `<div style="margin-bottom:12px;">
        <div onclick="toggleCrmGroup('${key.replace(/'/g, "\\'")}')"
          style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--dark);border-radius:var(--radius-sm);cursor:pointer;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#F5ECD7;">${key}</span>
          <span style="font-size:10px;color:var(--gold);">${grpItems.length} ${collapsed ? '▸' : '▾'}</span>
        </div>
        ${collapsed ? '' : buildGrid(grpItems)}
      </div>`;
    }).join('');
    return;
  }

  list.innerHTML = buildGrid(items);
}

function toggleCrmGroup(key) {
  crmCollapsed[key] = !crmCollapsed[key];
  crmRender();
}

// ── LIST GRID ─────────────────────────────────────────────────────────────────
function buildGrid(items) {
  if (!items.length) return '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px;font-style:italic;">No leads found.</div>';

  const isMobile = window.innerWidth < 640;

  if (isMobile) {
    return items.map(c => {
      const src = SRC_CFG[c.db] || SRC_CFG.email;
      const reached = c.reachedOutOn || [];
      return `<div onclick="openCrmModal('${c.id}')"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name || 'Unnamed'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${cleanLocation(c.location)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
          ${reached.map(r => `<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:100px;background:${src.bg};color:${src.color};">${r}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  const header = `<div style="display:grid;grid-template-columns:2fr 1.5fr 1fr;border-bottom:2px solid var(--border);padding:6px 12px;margin-bottom:2px;">
    ${['NAME', 'LOCATION', 'REACHED OUT · STAGE'].map((h, i) => `<div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--gold);${i === 2 ? 'text-align:right;' : ''}">${h}</div>`).join('')}
  </div>`;

  const rows = items.map((c, i) => {
    const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--bg)';
    const src = SRC_CFG[c.db] || SRC_CFG.email;
    const reached = c.reachedOutOn || [];
    const stage = STAGES.find(s => s.key === getStage(c));
    return `<div onclick="openCrmModal('${c.id}')"
      style="display:grid;grid-template-columns:2fr 1.5fr 1fr;padding:9px 12px;background:${bg};cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s;"
      onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='${bg}'">
      <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;">${c.name || 'Unnamed'}</div>
      <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;">${cleanLocation(c.location)}</div>
      <div style="display:flex;gap:3px;justify-content:flex-end;flex-wrap:wrap;align-items:center;">
        ${reached.slice(0, 2).map(r => `<span style="font-size:8px;font-weight:700;padding:2px 7px;border-radius:100px;background:${src.bg};color:${src.color};">${r}</span>`).join('')}
        ${stage ? `<span style="font-size:8px;font-weight:700;padding:2px 7px;border-radius:100px;background:${stage.bg};color:${stage.color};border:1px solid ${stage.border};">${stage.label.replace(/^\S+\s/, '')}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">${header}${rows}</div>`;
}

// ── PIPELINE VIEW ─────────────────────────────────────────────────────────────
function renderPipeline(items) {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const closedCount  = items.filter(c => getStage(c) === 'closed').length;
  const activeCount  = items.filter(c => getStage(c) !== 'dead').length;
  const src = SRC_CFG[crmTab] || SRC_CFG.email;

  let html = `
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;color:var(--dark);">${activeCount}</div>
        <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Active Leads</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;color:#2E7D32;">${closedCount}</div>
        <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Sales Closed</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin;">`;

  STAGES.forEach(stage => {
    const stageItems = crmSort(items.filter(c => getStage(c) === stage.key));
    const rows = stageItems.map(c => {
      const reached = c.reachedOutOn || [];
      return `<div
        draggable="true"
        data-id="${c.id}"
        ondragstart="pipelineDragStart(event,'${c.id}')"
        ondragend="pipelineDragEnd(event)"
        onclick="openCrmModal('${c.id}')"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;cursor:grab;transition:all .15s;user-select:none;margin-bottom:4px;"
        onmouseover="this.style.borderColor='var(--gold-lt)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${c.name || 'Unnamed'}</div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:5px;">${cleanLocation(c.location)}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          ${reached.map(r => `<span style="font-size:8px;font-weight:700;padding:1px 6px;border-radius:100px;background:${src.bg};color:${src.color};">${r}</span>`).join('')}
        </div>
      </div>`;
    }).join('');

    html += `<div style="flex:0 0 200px;display:flex;flex-direction:column;">
      <div style="padding:8px 10px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;background:${stage.bg};border:1px solid ${stage.border};border-bottom:none;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:${stage.color};">${stage.label}</span>
        <span style="font-size:10px;font-weight:600;color:${stage.color};opacity:.7;">${stageItems.length}</span>
      </div>
      <div
        data-stage="${stage.key}"
        ondragover="pipelineDragOver(event)"
        ondragleave="pipelineDragLeave(event)"
        ondrop="pipelineDrop(event,'${stage.key}')"
        style="flex:1;min-height:80px;border:1px solid ${stage.border};border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);padding:6px;background:${stage.bg}22;transition:background .15s;">
        ${rows}
      </div>
    </div>`;
  });

  html += `</div>`;
  list.innerHTML = html;
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────────
function pipelineDragStart(e, id) {
  dragItemId = id;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}
function pipelineDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  document.querySelectorAll('[data-stage]').forEach(col => { col.style.background = ''; });
}
function pipelineDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.background = 'rgba(184,147,90,.12)';
}
function pipelineDragLeave(e) { e.currentTarget.style.background = ''; }

async function pipelineDrop(e, stageKey) {
  e.preventDefault();
  e.currentTarget.style.background = '';
  if (!dragItemId) return;

  const lead = allLeads().find(x => x.id === dragItemId);
  if (!lead || getStage(lead) === stageKey) return;

  // Map stage key to status string per db
  let newStatus;
  if (lead.db === 'whatsapp') {
    newStatus = stageKey === 'closed' ? 'Converted to Customer' : stageKey === 'warm' ? 'Booked a call' : null;
  } else {
    newStatus = stageKey === 'closed' ? 'SALE CLOSED' : stageKey === 'warm' ? 'WARM: Booked a call OR asked for help' : 'Followed + Engaged';
  }
  if (!newStatus) return;

  lead.status = newStatus;
  crmRender();

  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: lead.id, db: lead.db, status: newStatus }),
    });
    dbg(`✓ ${lead.name} → ${stageKey}`);
  } catch (err) { dbg('Drag save failed: ' + err.message); }
  dragItemId = null;
}

// ── FETCH / LOAD ──────────────────────────────────────────────────────────────
async function loadCRM(force = false) {
  if (!crmLoaded || force) {
    const list = document.getElementById('crm-list');
    if (list) list.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px;font-style:italic;">Loading…</div>`;
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
      crmSwitchTab(crmTab);
    } catch (e) {
      if (list) list.innerHTML = `<div style="text-align:center;padding:40px 0;color:#B71C1C;font-size:13px;">Could not load: ${e.message}</div>`;
      dbg('CRM load failed: ' + e.message);
    } finally {
      if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
    }
  } else {
    crmRender();
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openCrmModal(id) {
  const c = allLeads().find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function openCrmModalEdit(id) {
  const c = allLeads().find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c, true);
  document.getElementById('crm-modal').classList.add('open');
}

function closeCrmModal(e) {
  if (!e || e.target === document.getElementById('crm-modal'))
    document.getElementById('crm-modal').classList.remove('open');
}

function crmDetailHTML(c, editMode = false) {
  const src = SRC_CFG[c.db] || SRC_CFG.email;
  const reached = c.reachedOutOn || [];
  const stage = STAGES.find(s => s.key === getStage(c));
  const isLead = c.db !== 'converted';

  // ── EDIT MODE ──
  if (editMode) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--dark);">${c.name || 'Unnamed'}</div>
        <button onclick="closeCrmModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div class="crm-section-hd">Details</div>
      <div class="fg"><label>Name</label><input id="ce-name" type="text" value="${c.name || ''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Company</label><input id="ce-company" type="text" value="${c.company || ''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Location</label><input id="ce-location" type="text" value="${cleanLocation(c.location)}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Email</label><input id="ce-email" type="text" value="${c.email || ''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Instagram</label><input id="ce-insta" type="text" value="${c.insta || ''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Website</label><input id="ce-website" type="text" value="${c.website || ''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      ${c.db === 'email' ? `<div class="fg"><label>Notes</label><textarea id="ce-notes" rows="3" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;resize:vertical;">${c.notes || ''}</textarea></div>` : ''}
      <button onclick="saveContactDetails('${c.id}','${c.db}')" class="ios-modal-close" style="margin-top:8px;">Save Changes</button>
      <button onclick="openCrmModal('${c.id}')" style="width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--muted);">Cancel</button>`;
  }

  // ── VIEW MODE ──
  const fields = [
    c.company  && ['Company',   c.company],
    c.email    && ['Email',     `<a href="mailto:${c.email}" style="color:var(--gold);">${c.email}</a>`],
    c.insta    && ['Instagram', c.insta],
    c.website  && ['Website',   `<a href="${c.website}" target="_blank" style="color:var(--gold);">${c.website}</a>`],
    c.linkedin && ['LinkedIn',  c.linkedin],
    c.whatsapp && ['WhatsApp',  c.whatsapp],
    c.whatsapp2 && ['WhatsApp 2', c.whatsapp2],
    c.engagedFirst && ['First contact', c.engagedFirst],
    c.engagedLast  && ['Last contact',  fmtD(c.engagedLast)],
    c.engageNext   && ['Engage next',   fmtD(c.engageNext)],
    c.suitability  && ['Suitability',   `<span class="crm-badge ${suitClass(c.suitability)}">${c.suitability}</span>`],
  ].filter(Boolean);

  // Status options per db
  let statusBlock = '';
  if (c.db === 'email') {
    statusBlock = `
      <div class="crm-section-hd">Pipeline Stage</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${PIPELINE_STATUSES_EMAIL.map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'whatsapp') {
    statusBlock = `
      <div class="crm-section-hd">Status</div>
      <select class="crm-select" onchange="savePipelineStage('${c.id}','${c.db}',this.value)">
        ${PIPELINE_STATUSES_WHATSAPP.map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
  } else if (c.db === 'converted') {
    const convStatuses = ['Face2Face conversation', 'Responded', 'Phone call', 'Booked Venue', 'Rejected Ubuntu'];
    statusBlock = `
      <div class="crm-section-hd">Status</div>
      <select class="crm-select" multiple size="3" onchange="savePipelineStage('${c.id}','${c.db}',Array.from(this.selectedOptions).map(o=>o.value))">
        ${convStatuses.map(s => `<option value="${s}" ${(Array.isArray(c.status) ? c.status : [c.status]).includes(s) ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
  }

  // Reached out on — multi-select toggles
  // For email DB: saveable to Notion. For others: UI-only visual.
  const reachedOutBlock = `
    <div class="crm-section-hd">Reached Out On</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;" id="reached-out-tags">
      ${REACHED_OUT_OPTIONS.map(opt => {
        const active = reached.includes(opt);
        return `<button
          data-opt="${opt}"
          data-active="${active}"
          onclick="toggleReachedOut('${c.id}','${c.db}','${opt}',this)"
          style="padding:5px 13px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);transition:all .15s;background:${active ? 'var(--gold)' : 'transparent'};color:${active ? 'var(--dark)' : 'var(--muted)'};">${opt}</button>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px;align-items:center;">
      <input id="custom-reached-input" type="text" placeholder="+ Custom channel…"
        style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:12px;background:var(--bg);outline:none;">
      <button onclick="addCustomReachedOut('${c.id}','${c.db}')"
        style="padding:6px 14px;border-radius:100px;border:1px solid var(--border);background:transparent;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer;color:var(--muted);">Add</button>
    </div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:var(--dark);line-height:1.2;">${c.name || 'Unnamed'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">${cleanLocation(c.location)}</div>
      </div>
      <button onclick="closeCrmModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);flex-shrink:0;margin-left:8px;">✕</button>
    </div>

    <div style="margin:8px 0;">
      <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${src.bg};color:${src.color};">${src.label}</span>
      ${stage ? `<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${stage.bg};color:${stage.color};border:1px solid ${stage.border};margin-left:4px;">${stage.label}</span>` : ''}
    </div>

    ${reachedOutBlock}
    ${statusBlock}

    ${fields.length ? `<div class="crm-section-hd">Info</div>${fields.map(([label, val]) => `<div class="crm-field"><div class="crm-field-label">${label}</div><div style="font-size:13px;">${val}</div></div>`).join('')}` : ''}
    ${c.notes ? `<div class="crm-section-hd">Notes</div><div style="font-size:13px;line-height:1.7;color:var(--text);">${c.notes}</div>` : ''}

    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;">
      <button onclick="openCrmModalEdit('${c.id}')" class="pill-btn" style="flex:1;">✎ Edit</button>
      ${isLead ? `<button onclick="promoteLead('${c.id}')" class="pill-btn dark" style="flex:1;">→ Convert</button>` : ''}
      <button onclick="if(confirm('Delete this lead?'))deleteLead('${c.id}')" class="pill-btn" style="color:#B71C1C;border-color:#FDECEA;">🗑</button>
    </div>`;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function toggleReachedOut(id, db, opt, btn) {
  const isActive = btn.dataset.active === 'true';
  btn.dataset.active = String(!isActive);
  btn.style.background = !isActive ? 'var(--gold)' : 'transparent';
  btn.style.color = !isActive ? 'var(--dark)' : 'var(--muted)';

  const container = btn.closest('#reached-out-tags');
  const selected = Array.from(container.querySelectorAll('button[data-active="true"]')).map(b => b.dataset.opt);

  const lead = allLeads().find(x => x.id === id);
  if (lead) lead.reachedOutOn = selected;

  fetch('/api/crm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateReachedOut', pageId: id, db, reachedOutOn: selected }),
  }).catch(e => dbg('reachedOut save failed: ' + e.message));
}

function addCustomReachedOut(id, db) {
  const input = document.getElementById('custom-reached-input');
  const val = input?.value?.trim();
  if (!val) return;
  input.value = '';

  const container = document.getElementById('reached-out-tags');
  if (!container) return;

  // Check not already there
  const existing = Array.from(container.querySelectorAll('button[data-opt]')).map(b => b.dataset.opt);
  if (existing.includes(val)) return;

  const btn = document.createElement('button');
  btn.dataset.opt = val;
  btn.dataset.active = 'true';
  btn.textContent = val;
  btn.style.cssText = 'padding:5px 13px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--gold);color:var(--dark);';
  btn.onclick = function() { toggleReachedOut(id, db, val, this); };
  container.appendChild(btn);

  const selected = Array.from(container.querySelectorAll('button[data-active="true"]')).map(b => b.dataset.opt);
  const lead = allLeads().find(x => x.id === id);
  if (lead) lead.reachedOutOn = selected;

  fetch('/api/crm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateReachedOut', pageId: id, db, reachedOutOn: selected }),
  }).catch(e => dbg('reachedOut save failed: ' + e.message));
}

async function savePipelineStage(id, db, status) {
  const lead = allLeads().find(x => x.id === id);
  if (lead) lead.status = status;
  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', pageId: id, db, status }),
    });
    dbg(`Stage saved: ${status}`);
  } catch (e) { dbg('Stage save failed: ' + e.message); }
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
  const lead = allLeads().find(x => x.id === id);
  if (lead) Object.assign(lead, props);
  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote', pageId: id, name: c.name, company: c.company,
        email: c.email, insta: c.insta, website: c.website, location: c.location, notes: c.notes }),
    });
    // Remove from whichever array it came from
    ['emailLeads', 'whatsappLeads', 'shalaLeads'].forEach(key => {
      if (crmData[key]) crmData[key] = crmData[key].filter(x => x.id !== id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
    dbg(`Promoted: ${c.name}`);
  } catch (e) { dbg('Promote failed: ' + e.message); }
}

async function deleteLead(id) {
  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', pageId: id }),
    });
    ['emailLeads', 'whatsappLeads', 'shalaLeads', 'converted'].forEach(key => {
      if (crmData[key]) crmData[key] = crmData[key].filter(x => x.id !== id);
    });
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
  } catch (e) { dbg('Delete failed: ' + e.message); }
}

// ── DUPLICATES ────────────────────────────────────────────────────────────────
function findDuplicates() {
  const groups = {};
  allLeads().forEach(c => {
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
  if (!dups.length) { list.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px;">No duplicates found ✓</div>'; return; }
  list.innerHTML = dups.map((group) =>
    `<div style="background:var(--surface);border:1px solid #FDECEA;border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:#B71C1C;margin-bottom:10px;letter-spacing:.08em;">DUPLICATE: ${group[0].name}</div>
      ${group.map((c, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:12px;font-weight:500;">${c.name} <span style="font-size:10px;color:var(--muted);">(${c.db})</span></div>
          <div style="font-size:11px;color:var(--muted);">${cleanLocation(c.location)}</div>
        </div>
        ${i > 0 ? `<button onclick="deleteDupConfirm('${c.id}','${c.name}')" style="padding:4px 12px;border-radius:100px;border:1px solid #FDECEA;background:transparent;color:#B71C1C;font-size:10px;font-weight:700;cursor:pointer;">Delete</button>` : '<span style="font-size:10px;color:#2E7D32;font-weight:600;">Keep</span>'}
      </div>`).join('')}
    </div>`
  ).join('');
}

async function deleteDupConfirm(id, name) {
  if (!confirm(`Delete duplicate: ${name}?`)) return;
  try {
    await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', pageId: id }) });
    ['emailLeads', 'whatsappLeads', 'shalaLeads', 'converted'].forEach(key => {
      if (crmData[key]) crmData[key] = crmData[key].filter(x => x.id !== id);
    });
    showDuplicates();
  } catch (e) { dbg('Delete dup failed: ' + e.message); }
}

// ── NEW LEAD ──────────────────────────────────────────────────────────────────
function openNewLeadModal() {
  ['nl-name', 'nl-company', 'nl-email', 'nl-insta', 'nl-whatsapp', 'nl-location', 'nl-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Pre-select the db matching current tab
  const dbSel = document.getElementById('nl-db');
  if (dbSel) dbSel.value = (crmTab === 'converted' ? 'email' : crmTab);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create', db,
        name,
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
