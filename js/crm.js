// js/crm.js — FRONTEND — deploy to /js/crm.js on GitHub

// ── STATE ─────────────────────────────────────────────────────────────────────
let crmView = 'list'; // 'list' | 'pipeline'
let crmCollapsed = {};
let dragItemId = null;

const REACHED_OUT_OPTIONS = ['Instagram', 'WhatsApp', 'Email', 'LinkedIn', 'Cold Call'];

// Pipeline stages — 3 columns as requested
const STAGES = [
  { key: 'cold',     label: '🌱 Cold Lead',   color: '#8B7355', bg: '#F5ECD7', border: '#D4B483',
    statuses: ['Followed + Engaged', 'Reached out', null, undefined, ''] },
  { key: 'warm',     label: '🤝 Converted Lead', color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9',
    statuses: ['WARM: Booked a call OR asked for help', 'HOT: Past client/strong conversation', 'QUALIFIED TO BUY'] },
  { key: 'closed',   label: '🎉 Sale Closed', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7',
    statuses: ['SALE CLOSED'] },
];

const DEAD_STATUSES = ['GHOSTED', 'TERMINATED', 'NOT GOOD FIT'];

// Map source db → default reached out on
function inferReachedOutOn(c) {
  if (c.reachedOutOn && c.reachedOutOn.length) return c.reachedOutOn;
  if (c.source === 'Instagram')    return ['Instagram'];
  if (c.source === 'WhatsApp')     return ['WhatsApp'];
  if (c.source === 'Shala Rental') return ['WhatsApp'];
  return [];
}

function getStage(c) {
  const s = Array.isArray(c.status) ? c.status[0] : c.status;
  for (const stage of STAGES) {
    if (stage.statuses.includes(s)) return stage.key;
  }
  if (DEAD_STATUSES.includes(s)) return 'dead';
  return 'cold';
}

function getNotionStatusForStage(key) {
  const map = {
    cold:   'Followed + Engaged',
    warm:   'Reached out',
    closed: 'SALE CLOSED',
  };
  return map[key] || 'Followed + Engaged';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function statusClass(s) {
  if (!s) return '';
  const sl = (Array.isArray(s) ? s[0] : s || '').toLowerCase();
  if (sl.includes('not good') || sl.includes('terminated')) return 'crm-status-not-good';
  if (sl.includes('ghosted'))   return 'crm-status-ghosted';
  if (sl.includes('followed'))  return 'crm-status-followed';
  if (sl.includes('reached'))   return 'crm-status-reached';
  if (sl.includes('warm') || sl.includes('booked')) return 'crm-status-warm';
  if (sl.includes('hot') || sl.includes('qualified')) return 'crm-status-hot';
  if (sl.includes('sale') || sl.includes('closed'))   return 'crm-status-closed';
  if (sl.includes('responded'))  return 'crm-status-responded';
  return 'crm-status-followed';
}

function suitClass(s) {
  if (!s) return '';
  if (s.startsWith('1')) return 'crm-suit-1';
  if (s.startsWith('2')) return 'crm-suit-2';
  if (s.startsWith('3')) return 'crm-suit-3';
  if (s.startsWith('4')) return 'crm-suit-4';
  return '';
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

const srcColor = { Instagram:'#1565C0', WhatsApp:'#2E7D32', 'Shala Rental':'#E65100' };
const srcBg    = { Instagram:'#E3F2FD', WhatsApp:'#E8F5E9', 'Shala Rental':'#FFF3E0' };

// ── TAB / VIEW ────────────────────────────────────────────────────────────────
function crmSwitchTab(tab) {
  crmTab = tab;
  ['leads','converted'].forEach(t => {
    document.getElementById('crm-tab-'+t)?.classList.toggle('active', t === tab);
  });
  crmRender();
}

function setCrmView(view) {
  crmView = view;
  document.getElementById('crm-view-list')?.classList.toggle('active', view === 'list');
  document.getElementById('crm-view-pipeline')?.classList.toggle('active', view === 'pipeline');
  crmRender();
}

// ── SORT / GROUP ──────────────────────────────────────────────────────────────
function crmSort(items) {
  const g = document.getElementById('crm-group')?.value || 'none';
  if (g === 'none_name')     return [...items].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  if (g === 'none_location') return [...items].sort((a,b) => cleanLocation(a.location).localeCompare(cleanLocation(b.location)));
  return [...items].sort((a,b) => new Date(b.lastEdited||0) - new Date(a.lastEdited||0));
}

function groupKey(c, groupBy) {
  if (groupBy === 'source')   return c.source || 'No Source';
  if (groupBy === 'location') return cleanLocation(c.location) || 'No Location';
  if (groupBy === 'status') {
    const s = Array.isArray(c.status) ? c.status[0] : c.status;
    return s || 'No Status';
  }
  if (groupBy === 'date') {
    const d = c.lastEdited ? new Date(c.lastEdited) : null;
    return d ? d.toLocaleDateString('en-GB',{month:'long',year:'numeric'}) : 'Unknown';
  }
  return '';
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const search  = (document.getElementById('crm-search')?.value || '').toLowerCase();
  const srcFilt = document.getElementById('crm-source-filter')?.value || '';
  const groupBy = (document.getElementById('crm-group')?.value || 'none').replace('none_name','none').replace('none_location','none');
  const realGroup = document.getElementById('crm-group')?.value || 'none';

  const raw = crmTab === 'converted' ? (crmData.converted || []) : (crmData.leads || []);
  let items = raw.filter(c => {
    if (search && !((c.name||'') + (c.location||'') + (c.company||'')).toLowerCase().includes(search)) return false;
    if (srcFilt && c.source !== srcFilt) return false;
    return true;
  });

  // Count
  const countEl = document.getElementById('crm-count');
  if (countEl) countEl.textContent = `${items.length} of ${raw.length}`;

  // Pipeline view
  if (crmView === 'pipeline' && crmTab === 'leads') {
    renderPipeline(items);
    return;
  }

  items = crmSort(items);

  // Grouped
  const needsGroup = realGroup.startsWith('location') || realGroup.startsWith('status') || realGroup.startsWith('source') || realGroup.startsWith('date');
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
        <div onclick="toggleCrmGroup('${key.replace(/'/g,"\\'")}')"
          style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--dark);border-radius:var(--radius-sm);cursor:pointer;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#F5ECD7;">${key}</span>
          <span style="font-size:10px;color:var(--gold);">${grpItems.length} ${collapsed?'▸':'▾'}</span>
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
      const reached = inferReachedOutOn(c);
      return `<div onclick="openCrmModal('${c.id}')"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name||'Unnamed'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${cleanLocation(c.location)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
          ${reached.map(r => `<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:100px;background:${srcBg[c.source]||'#F5ECD7'};color:${srcColor[c.source]||'#5C3D2E'};">${r}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // Desktop: compact rows
  const header = `<div style="display:grid;grid-template-columns:2fr 1.5fr 1fr;border-bottom:2px solid var(--border);padding:6px 12px;margin-bottom:2px;">
    ${['NAME','LOCATION','REACHED OUT · STAGE'].map((h,i) => `<div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--gold);${i===2?'text-align:right;':''}">${h}</div>`).join('')}
  </div>`;

  const rows = items.map((c,i) => {
    const bg = i%2===0 ? 'var(--surface)' : 'var(--bg)';
    const reached = inferReachedOutOn(c);
    const stage = STAGES.find(s => s.key === getStage(c));
    return `<div onclick="openCrmModal('${c.id}')"
      style="display:grid;grid-template-columns:2fr 1.5fr 1fr;padding:9px 12px;background:${bg};cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s;"
      onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='${bg}'">
      <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;">${c.name||'Unnamed'}</div>
      <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;">${cleanLocation(c.location)}</div>
      <div style="display:flex;gap:3px;justify-content:flex-end;flex-wrap:wrap;align-items:center;">
        ${reached.slice(0,2).map(r => `<span style="font-size:8px;font-weight:700;padding:2px 7px;border-radius:100px;background:${srcBg[c.source]||'#F5ECD7'};color:${srcColor[c.source]||'#5C3D2E'};">${r}</span>`).join('')}
        ${stage ? `<span style="font-size:8px;font-weight:700;padding:2px 7px;border-radius:100px;background:${stage.bg};color:${stage.color};border:1px solid ${stage.border};">${stage.label.replace(/^\S+\s/,'')}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">${header}${rows}</div>`;
}

// ── PIPELINE VIEW ─────────────────────────────────────────────────────────────
function renderPipeline(items) {
  const list = document.getElementById('crm-list');
  if (!list) return;

  const closedCount = items.filter(c => getStage(c) === 'closed').length;
  const activeCount = items.filter(c => getStage(c) !== 'dead').length;

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

    // Compact list rows inside column
    const rows = stageItems.map(c => {
      const reached = inferReachedOutOn(c);
      return `<div
        draggable="true"
        data-id="${c.id}"
        ondragstart="pipelineDragStart(event,'${c.id}')"
        ondragend="pipelineDragEnd(event)"
        onclick="openCrmModal('${c.id}')"
        style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;cursor:grab;transition:all .15s;user-select:none;margin-bottom:4px;"
        onmouseover="this.style.borderColor='var(--gold-lt)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${c.name||'Unnamed'}</div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:5px;">${cleanLocation(c.location)}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          ${reached.map(r => `<span style="font-size:8px;font-weight:700;padding:1px 6px;border-radius:100px;background:var(--bg2);color:var(--muted);">${r}</span>`).join('')}
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
  document.querySelectorAll('[data-stage]').forEach(col => {
    col.style.background = '';
    col.style.border = '';
  });
}
function pipelineDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.background = 'rgba(184,147,90,.12)';
}
function pipelineDragLeave(e) {
  e.currentTarget.style.background = '';
}
async function pipelineDrop(e, stageKey) {
  e.preventDefault();
  e.currentTarget.style.background = '';
  if (!dragItemId) return;

  const lead = (crmData.leads||[]).find(x => x.id === dragItemId);
  if (!lead) return;
  if (getStage(lead) === stageKey) return; // no-op

  const newStatus = getNotionStatusForStage(stageKey);

  // Optimistic update
  lead.status = newStatus;
  crmRender();

  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', pageId:lead.id, db:lead.db, source:lead.source, status:newStatus })
    });
    dbg(`✓ ${lead.name} → ${stageKey}`);
  } catch(err) {
    dbg('Drag save failed: ' + err.message);
  }
  dragItemId = null;
}

// ── FETCH ─────────────────────────────────────────────────────────────────────
async function fetchCRM(force=false) {
  const r = await fetch('/api/crm', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action:'load', forceRefresh: force })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function loadCRM(force=false) {
  if (!crmLoaded || force) {
    const list = document.getElementById('crm-list');
    if (list) list.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px;font-style:italic;">Loading…</div>`;
    const btn = document.getElementById('crm-refresh-btn');
    if (btn) { btn.textContent = '↻ Loading…'; btn.disabled = true; }
    try {
      crmData = await fetchCRM(force);
      crmLoaded = true;
      const c = crmData._counts||{};
      dbg(`CRM: ${(crmData.leads||[]).length} leads (ig:${c.instagram||0} wa:${c.whatsapp||0} shala:${c.shala||0}) + ${(crmData.converted||[]).length} converted`);
      crmSwitchTab(crmTab);
      crmRender();
    } catch(e) {
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
  const c = [...(crmData.leads||[]), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c);
  document.getElementById('crm-modal').classList.add('open');
}

function openCrmModalEdit(id) {
  const c = [...(crmData.leads||[]), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  document.getElementById('crm-modal-content').innerHTML = crmDetailHTML(c, true);
  document.getElementById('crm-modal').classList.add('open');
}

function closeCrmModal(e) {
  if (!e || e.target === document.getElementById('crm-modal'))
    document.getElementById('crm-modal').classList.remove('open');
}

function crmDetailHTML(c, editMode=false) {
  const isLead = c.db === 'leads';
  const reached = inferReachedOutOn(c);
  const stage = STAGES.find(s => s.key === getStage(c));

  if (editMode) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--dark);">${c.name||'Unnamed'}</div>
        <button onclick="closeCrmModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div class="crm-section-hd">Details</div>
      <div class="fg"><label>Name</label><input id="ce-name" class="fg input" type="text" value="${c.name||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Company</label><input id="ce-company" type="text" value="${c.company||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Location</label><input id="ce-location" type="text" value="${cleanLocation(c.location)}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Email</label><input id="ce-email" type="text" value="${c.email||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Instagram</label><input id="ce-insta" type="text" value="${c.insta||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Website</label><input id="ce-website" type="text" value="${c.website||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;"></div>
      <div class="fg"><label>Notes</label><textarea id="ce-notes" rows="3" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;background:var(--bg);outline:none;resize:vertical;">${c.notes||''}</textarea></div>
      <button onclick="saveContactDetails('${c.id}','${c.db}')" class="ios-modal-close" style="margin-top:8px;">Save Changes</button>
      <button onclick="openCrmModal('${c.id}')" style="width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--border);border-radius:100px;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--muted);">Cancel</button>`;
  }

  // View mode
  const fields = [
    c.company    && ['Company',  c.company],
    c.email      && ['Email',    `<a href="mailto:${c.email}" style="color:var(--gold);">${c.email}</a>`],
    c.insta      && ['Instagram', c.insta],
    c.website    && ['Website',  `<a href="${c.website}" target="_blank" style="color:var(--gold);">${c.website}</a>`],
    c.linkedin   && ['LinkedIn', c.linkedin],
    c.whatsapp   && ['WhatsApp', c.whatsapp],
    c.engagedFirst && ['First contact', fmtD(c.engagedFirst)],
    c.engagedLast  && ['Last contact',  fmtD(c.engagedLast)],
    c.engageNext   && ['Engage next',   fmtD(c.engageNext)],
    c.suitability  && ['Suitability',   `<span class="crm-badge ${suitClass(c.suitability)}">${c.suitability}</span>`],
  ].filter(Boolean);

  const convStatuses = ['Face2Face conversation','Responded','Phone call','Booked Venue','Rejected Ubuntu'];

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:var(--dark);line-height:1.2;">${c.name||'Unnamed'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">${cleanLocation(c.location)}</div>
      </div>
      <button onclick="closeCrmModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);flex-shrink:0;margin-left:8px;">✕</button>
    </div>

    ${stage ? `<div style="margin:10px 0;"><span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;background:${stage.bg};color:${stage.color};border:1px solid ${stage.border};">${stage.label}</span></div>` : ''}

    <div class="crm-section-hd">Reached Out On</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      ${REACHED_OUT_OPTIONS.map(opt => {
        const active = reached.includes(opt);
        return `<button
          data-active="${active}"
          onclick="toggleReachedOut('${c.id}','${c.source||''}','${opt}',this)"
          style="padding:5px 13px;border-radius:100px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);transition:all .15s;background:${active?'var(--gold)':'transparent'};color:${active?'var(--dark)':'var(--muted)'};">${opt}</button>`;
      }).join('')}
    </div>

    ${isLead ? `
    <div class="crm-section-hd">Pipeline Stage</div>
    <select class="crm-select" id="crm-stage-sel" onchange="savePipelineStage('${c.id}','${c.source||''}',this.value)">
      <option value="Followed + Engaged" ${(!c.status||c.status==='Followed + Engaged')?'selected':''}>🌱 Cold Lead</option>
      <option value="Reached out" ${c.status==='Reached out'?'selected':''}>📬 Reached Out</option>
      <option value="WARM: Booked a call OR asked for help" ${c.status==='WARM: Booked a call OR asked for help'?'selected':''}>🔥 Warm — Call Booked</option>
      <option value="HOT: Past client/strong conversation" ${c.status==='HOT: Past client/strong conversation'?'selected':''}>⚡ Hot</option>
      <option value="QUALIFIED TO BUY" ${c.status==='QUALIFIED TO BUY'?'selected':''}>✅ Qualified</option>
      <option value="SALE CLOSED" ${c.status==='SALE CLOSED'?'selected':''}>🎉 Sale Closed</option>
      <option value="GHOSTED" ${c.status==='GHOSTED'?'selected':''}>👻 Ghosted</option>
      <option value="NOT GOOD FIT" ${c.status==='NOT GOOD FIT'?'selected':''}>✗ Not a Fit</option>
    </select>` : `
    <div class="crm-section-hd">Status</div>
    <select class="crm-select" id="crm-stage-sel" multiple size="3" onchange="savePipelineStage('${c.id}','${c.source||''}',Array.from(this.selectedOptions).map(o=>o.value))">
      ${convStatuses.map(s=>`<option value="${s}" ${(Array.isArray(c.status)?c.status:[c.status]).includes(s)?'selected':''}>${s}</option>`).join('')}
    </select>`}

    ${fields.length ? `<div class="crm-section-hd">Info</div>${fields.map(([label,val])=>`<div class="crm-field"><div class="crm-field-label">${label}</div><div style="font-size:13px;">${val}</div></div>`).join('')}` : ''}

    ${c.notes ? `<div class="crm-section-hd">Notes</div><div style="font-size:13px;line-height:1.7;color:var(--text);">${c.notes}</div>` : ''}

    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;">
      <button onclick="openCrmModalEdit('${c.id}')" class="pill-btn" style="flex:1;">✎ Edit</button>
      ${isLead ? `<button onclick="promoteLead('${c.id}')" class="pill-btn dark" style="flex:1;">→ Convert</button>` : ''}
      <button onclick="if(confirm('Delete this lead?'))deleteLead('${c.id}')" class="pill-btn" style="color:#B71C1C;border-color:#FDECEA;">🗑</button>
    </div>`;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function toggleReachedOut(id, source, opt, btn) {
  const isActive = btn.dataset.active === 'true';
  btn.dataset.active = String(!isActive);
  btn.style.background = !isActive ? 'var(--gold)' : 'transparent';
  btn.style.color = !isActive ? 'var(--dark)' : 'var(--muted)';
  const allBtns = btn.closest('[style*="flex-wrap"]').querySelectorAll('button');
  const selected = Array.from(allBtns).filter(b => b.dataset.active === 'true').map(b => b.textContent.trim());
  // Update local cache
  const lead = [...(crmData.leads||[]),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) lead.reachedOutOn = selected;
  fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'updateReachedOut', pageId:id, reachedOutOn:selected })
  }).catch(e => dbg('reachedOut save failed: ' + e.message));
}

async function savePipelineStage(id, source, status) {
  const lead = [...(crmData.leads||[]),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) lead.status = status;
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', pageId:id, source, status })
    });
    dbg(`Stage saved: ${status}`);
  } catch(e) { dbg('Stage save failed: ' + e.message); }
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
  // Update local cache
  const lead = [...(crmData.leads||[]),...(crmData.converted||[])].find(x=>x.id===id);
  if (lead) Object.assign(lead, props);
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateDetails', pageId:id, props:{
        'Name':     { title:     [{ text:{content: props.name||'' } }] },
        'Company':  { rich_text: [{ text:{content: props.company||'' } }] },
        'Location': { rich_text: [{ text:{content: props.location||'' } }] },
        'Notes':    { rich_text: [{ text:{content: props.notes||'' } }] },
      }})
    });
    dbg('Contact saved');
    openCrmModal(id);
  } catch(e) { dbg('Save failed: ' + e.message); }
}

async function promoteLead(id) {
  const c = (crmData.leads||[]).find(x=>x.id===id);
  if (!c || !confirm(`Move ${c.name} to Converted?`)) return;
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'promote', pageId:id, name:c.name, company:c.company,
        email:c.email, insta:c.insta, website:c.website, location:c.location, notes:c.notes })
    });
    crmData.leads = (crmData.leads||[]).filter(x=>x.id!==id);
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
    dbg(`Promoted: ${c.name}`);
  } catch(e) { dbg('Promote failed: ' + e.message); }
}

async function deleteLead(id) {
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', pageId:id })
    });
    crmData.leads = (crmData.leads||[]).filter(x=>x.id!==id);
    crmData.converted = (crmData.converted||[]).filter(x=>x.id!==id);
    document.getElementById('crm-modal').classList.remove('open');
    crmRender();
  } catch(e) { dbg('Delete failed: ' + e.message); }
}

// ── NEW LEAD ──────────────────────────────────────────────────────────────────
function openNewLeadModal() {
  ['nl-name','nl-company','nl-email','nl-insta','nl-whatsapp','nl-location','nl-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('new-lead-modal').classList.add('open');
}

function closeNewLeadModal(e) {
  if (!e || e.target === document.getElementById('new-lead-modal'))
    document.getElementById('new-lead-modal').classList.remove('open');
}

async function saveNewLead() {
  const name = document.getElementById('nl-name')?.value;
  if (!name) { alert('Name is required'); return; }
  const source = document.getElementById('nl-source')?.value || 'Instagram';
  try {
    const r = await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'create', name, source,
        company:  document.getElementById('nl-company')?.value,
        email:    document.getElementById('nl-email')?.value,
        insta:    document.getElementById('nl-insta')?.value,
        whatsapp: document.getElementById('nl-whatsapp')?.value,
        location: document.getElementById('nl-location')?.value,
        notes:    document.getElementById('nl-notes')?.value,
      })
    });
    const d = await r.json();
    document.getElementById('new-lead-modal').classList.remove('open');
    loadCRM(true);
  } catch(e) { dbg('Create failed: ' + e.message); }
}

// ── DUPLICATES ────────────────────────────────────────────────────────────────
function findDuplicates() {
  const leads = crmData.leads || [];
  const groups = {};
  leads.forEach(c => {
    const key = (c.name||'').toLowerCase().trim();
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
  list.innerHTML = dups.map((group, gi) =>
    `<div style="background:var(--surface);border:1px solid #FDECEA;border-radius:var(--radius-sm);padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:#B71C1C;margin-bottom:10px;letter-spacing:.08em;">DUPLICATE: ${group[0].name}</div>
      ${group.map((c,i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:12px;font-weight:500;">${c.name} <span style="font-size:10px;color:var(--muted);">(${c.source})</span></div>
          <div style="font-size:11px;color:var(--muted);">${cleanLocation(c.location)}</div>
        </div>
        ${i > 0 ? `<button onclick="deleteDupConfirm('${c.id}','${c.name}',${gi})" style="padding:4px 12px;border-radius:100px;border:1px solid #FDECEA;background:transparent;color:#B71C1C;font-size:10px;font-weight:700;cursor:pointer;">Delete</button>` : '<span style="font-size:10px;color:#2E7D32;font-weight:600;">Keep</span>'}
      </div>`).join('')}
    </div>`
  ).join('');
}

async function deleteDupConfirm(id, name, groupIndex) {
  if (!confirm(`Delete duplicate: ${name}?`)) return;
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', pageId:id })
    });
    crmData.leads = (crmData.leads||[]).filter(x => x.id !== id);
    showDuplicates();
  } catch(e) { dbg('Delete dup failed: ' + e.message); }
}

// ── LINKED DRAFTS ─────────────────────────────────────────────────────────────
function getLinkedDrafts(name, company) {
  return (window._drafts||[]).filter(d =>
    (name && (d.organizer||'').toLowerCase().includes(name.toLowerCase())) ||
    (company && (d.company||'').toLowerCase().includes((company||'').toLowerCase()))
  );
}

function loadDraftById(pageId) {
  const draft = (window._drafts||[]).find(d => d.pageId === pageId);
  if (!draft) return;
  if (typeof setFormState === 'function') setFormState(JSON.parse(draft.formState));
  switchTab('deal');
  switchDealTab('edit');
}

function prefillOfferFromCRM(id) {
  const c = [...(crmData.leads||[]),...(crmData.converted||[])].find(x=>x.id===id);
  if (!c) return;
  const n = document.getElementById('f-name'); if(n) n.value = c.name||'';
  const co = document.getElementById('f-company'); if(co) co.value = c.company||'';
  const em = document.getElementById('f-website'); if(em) em.value = c.website||'';
  switchTab('deal');
  switchDealTab('edit');
}
