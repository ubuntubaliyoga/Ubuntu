// ── DUPLICATES ───────────────────────────────────────────────────────────────
function findDuplicates() {
  const all = [...(crmData.leads||[]), ...(crmData.converted||[])];
  const groups = {};
  all.forEach(c => {
    const key = (c.name||'').toLowerCase().trim().replace(/\s+/g,' ');
    if (!key || key === 'new lead') return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return Object.values(groups).filter(g => g.length > 1);
}

function showDuplicates() {
  const dups = findDuplicates();
  const modal = document.getElementById('crm-modal');
  const content = document.getElementById('crm-modal-content');

  if (dups.length === 0) {
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-family:'Libre Baskerville',serif;font-size:15px;font-weight:700;color:#221208;">Duplicates</div>
        <button onclick="document.getElementById('crm-modal').classList.remove('open')" style="background:none;border:none;font-size:20px;cursor:pointer;color:#8B7355;">✕</button>
      </div>
      <div style="font-family:'Lora',serif;font-size:13px;color:#8B7355;font-style:italic;padding:20px 0;text-align:center;">No duplicates found 🎉</div>`;
    modal.classList.add('open');
    return;
  }

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-family:'Libre Baskerville',serif;font-size:15px;font-weight:700;color:#221208;">Duplicates (${dups.length})</div>
      <button onclick="document.getElementById('crm-modal').classList.remove('open')" style="background:none;border:none;font-size:20px;cursor:pointer;color:#8B7355;">✕</button>
    </div>
    <div style="font-family:'Lora',serif;font-size:11px;color:#8B7355;margin-bottom:14px;">Same name found in multiple entries. Review and merge or delete.</div>
    ${dups.map((group, gi) => `
      <div style="border:1px solid #EDE3D4;border-radius:4px;margin-bottom:12px;overflow:hidden;">
        <div style="background:#F5ECD7;padding:8px 12px;font-family:'Libre Baskerville',serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#5C3D2E;font-weight:700;">${group[0].name}</div>
        ${group.map(c => `
          <div style="padding:10px 12px;border-top:1px solid #EDE3D4;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-family:'Lora',serif;font-size:12px;color:#1A1208;">${c.db === 'leads' ? '📋 Lead Pipeline' : '✓ Converted'} · ${c.location||'No location'}</div>
              <div style="font-family:'Lora',serif;font-size:10px;color:#8B7355;margin-top:2px;">${c.lastEdited ? new Date(c.lastEdited).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="openCrmModal('${c.id}');document.getElementById('crm-modal').classList.add('open')" style="padding:5px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Libre Baskerville',serif;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:transparent;color:#8B7355;">View</button>
              <button onclick="deleteDupConfirm('${c.id}','${c.name}',${gi})" style="padding:5px 10px;border:1px solid #F5D6D6;border-radius:3px;font-family:'Libre Baskerville',serif;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:transparent;color:#8A1A1A;">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}`;
  modal.classList.add('open');
}

async function deleteDupConfirm(id, name, groupIndex) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await fetch('/api/crm', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'delete', pageId: id})
    });
    // Remove from local data
    crmData.leads = crmData.leads.filter(x => x.id !== id);
    crmData.converted = crmData.converted.filter(x => x.id !== id);
    showDuplicates(); // refresh duplicate view
  } catch(e) { alert('Could not delete.'); }
}

// ── LINKED DRAFTS IN CRM ─────────────────────────────────────────────────────
function getLinkedDrafts(contactName, company) {
  if (!window._drafts || (!contactName && !company)) return [];
  const name = (contactName||'').toLowerCase();
  const comp = (company||'').toLowerCase();
  return window._drafts.filter(d =>
    (d.organizer && d.organizer.toLowerCase().includes(name) && name) ||
    (d.retreatName && comp && d.retreatName.toLowerCase().includes(comp))
  );
}

// ── CRM ──────────────────────────────────────────────────────────────────────
function statusClass(s) {
  if (!s) return '';
  const m = {
    'NOT GOOD FIT':'not-good','TERMINATED':'terminated','GHOSTED':'ghosted',
    'Followed + Engaged':'followed','Reached out':'reached',
    'WARM: Booked a call OR asked for help':'warm',
    'HOT: Past client/strong conversation':'hot',
    'QUALIFIED TO BUY':'qualified','SALE CLOSED':'closed',
    'Face2Face conversation':'face2face','Rejected Ubuntu':'not-good',
    'Responded':'responded','Phone call':'phone','Booked Venue':'booked',
  };
  return 'crm-status-' + (m[s] || 'reached');
}

function suitClass(s) {
  if (!s) return '';
  if (s.startsWith('1')) return 'crm-suit-1';
  if (s.startsWith('2')) return 'crm-suit-2';
  if (s.startsWith('3')) return 'crm-suit-3';
  return 'crm-suit-4';
}

function crmSwitchTab(tab) {
  crmTab = tab;
  ['leads','converted'].forEach(t => {
    const b = document.getElementById('crm-tab-'+t);
    if (!b) return;
    b.style.background = t === tab ? '#B8935A' : 'transparent';
    b.style.color = t === tab ? '#fff' : '#B8935A';
    b.style.borderColor = t === tab ? '#B8935A' : 'rgba(184,147,90,.35)';
  });
  crmCollapsed = {};
  crmRender();
}

function crmSort(items) {
  const g = document.getElementById('crm-group')?.value || 'none';
  return [...items].sort((a, b) => {
    if (g === 'none_name')     return (a.name||'').localeCompare(b.name||'');
    if (g === 'none_location') return (a.location||'').localeCompare(b.location||'');
    return new Date(b.lastEdited||0) - new Date(a.lastEdited||0); // default date desc
  });
}

function groupKey(c, groupBy) {
  if (groupBy === 'status') {
    const s = Array.isArray(c.status) ? c.status[0] : c.status;
    return s || 'No Status';
  }
  if (groupBy === 'source')   return c.source || 'No Source';
  if (groupBy === 'location') return c.location || 'No Location';
  if (groupBy === 'date') {
    if (!c.lastEdited) return 'Unknown';
    return new Date(c.lastEdited).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
  }
  return null;
}

function buildGrid(items) {
  const hRow = ['Name','Location','Source / Status','Added'].map(h =>
    `<div style="padding:6px 10px;font-family:'Libre Baskerville',serif;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#B8935A;background:#F5ECD7;border-bottom:1px solid #EDE3D4;">${h}</div>`
  ).join('');

  const rows = items.map((c, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#FDFAF5';
    const statusArr = Array.isArray(c.status) ? c.status : (c.status ? [c.status] : []);
    const statusHtml = statusArr.map(s => `<span class="crm-badge ${statusClass(s)}" style="font-size:7px;">${s}</span>`).join(' ');
    const srcColors = {'Instagram':'#E3F2FD','WhatsApp':'#E8F5E9','Shala Rental':'#FFF3E0'};
    const srcTextColors = {'Instagram':'#1565C0','WhatsApp':'#2E7D32','Shala Rental':'#E65100'};
    const sourceBadge = c.source ? `<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:7px;font-family:'Libre Baskerville',serif;letter-spacing:.06em;text-transform:uppercase;font-weight:700;background:${srcColors[c.source]||'#F5ECD7'};color:${srcTextColors[c.source]||'#5C3D2E'};margin-right:4px;">${c.source}</span>` : '';
    const date = c.lastEdited ? new Date(c.lastEdited).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—';
    const cell = `padding:8px 10px;cursor:pointer;border-bottom:1px solid #EDE3D4;`;
    return `
      <div onclick="openCrmModal('${c.id}')" style="${cell}font-family:'Lora',serif;font-size:12px;color:#1A1208;background:${bg};">${c.name||'Unnamed'}</div>
      <div onclick="openCrmModal('${c.id}')" style="${cell}font-family:'Lora',serif;font-size:11px;color:#8B7355;background:${bg};">${c.location||'—'}</div>
      <div onclick="openCrmModal('${c.id}')" style="${cell}background:${bg};">${sourceBadge}${statusHtml||'—'}</div>
      <div onclick="openCrmModal('${c.id}')" style="${cell}font-family:'Lora',serif;font-size:10px;color:#B8935A;background:${bg};">${date}</div>
    `;
  }).join('');

  return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0;border:1px solid #EDE3D4;border-radius:4px;overflow:hidden;margin-bottom:8px;">${hRow}${rows}</div>`;
}

function crmRender() {
  const list = document.getElementById('crm-list');
  if (!list) return; // view not in DOM yet
  const q = (document.getElementById('crm-search')?.value || '').toLowerCase();
  const groupRaw = document.getElementById('crm-group')?.value || 'none';
  const groupBy = groupRaw.startsWith('none') ? 'none' : groupRaw;
  const sourceFilter = document.getElementById('crm-source-filter')?.value || '';

  let items = (crmData[crmTab] || []).filter(c => {
    const matchQ = !q || (c.name||'').toLowerCase().includes(q) ||
                         (c.company||'').toLowerCase().includes(q) ||
                         (c.location||'').toLowerCase().includes(q);
    const matchS = !sourceFilter || c.source === sourceFilter;
    return matchQ && matchS;
  });
  items = crmSort(items);

  const countEl = document.getElementById('crm-count');
  if (countEl) countEl.textContent = items.length + ' of ' + (crmData[crmTab]||[]).length;

  if (items.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px 0;font-family:'Lora',serif;font-size:13px;color:#8B7355;font-style:italic;">${crmLoaded ? 'No results.' : 'Loading…'}</div>`;
    return;
  }

  if (groupBy === 'none') {
    list.innerHTML = buildGrid(items);
    return;
  }

  // Grouped with collapsible sections
  const groups = {};
  items.forEach(c => {
    const key = groupKey(c, groupBy);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  list.innerHTML = Object.entries(groups).map(([key, groupItems]) => {
    const isCollapsed = !!crmCollapsed[key];
    return `
      <div style="margin-bottom:4px;">
        <div onclick="toggleCrmGroup('${key.replace(/'/g,'\'')}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#221208;border-radius:${isCollapsed?'4px':'4px 4px 0 0'};cursor:pointer;user-select:none;">
          <span style="font-family:'Libre Baskerville',serif;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#F5ECD7;">${key}</span>
          <span style="font-family:'Lora',serif;font-size:10px;color:#B8935A;">${groupItems.length} &nbsp; ${isCollapsed?'▸':'▾'}</span>
        </div>
        ${isCollapsed ? '' : buildGrid(groupItems)}
      </div>`;
  }).join('');
}

function toggleCrmGroup(key) {
  crmCollapsed[key] = !crmCollapsed[key];
  crmRender();
}

async function fetchCRM(force=false) {
  const r = await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'load', forceRefresh: !!force }) });
  const data = await r.json();
  if (!data.leads) throw new Error(JSON.stringify(data));
  return data;
}

async function loadCRM(force=false) {
  if (!crmLoaded) {
    $('crm-list').innerHTML = `<div style="text-align:center;padding:40px 0;font-family:'Lora',serif;font-size:13px;color:#8B7355;font-style:italic;">Loading…</div>`;
    try {
      crmData = await fetchCRM(false);
      crmLoaded = true;
      crmRender();
    } catch(e) {
      $('crm-list').innerHTML = `<div style="text-align:center;padding:40px 0;font-family:'Lora',serif;font-size:13px;color:#8B3A2E;">Could not load CRM: ${e.message}</div>`;
      return;
    }
  } else {
    crmRender();
  }
  fetchCRM(force).then(data => {
    crmData = data;
    crmRender();
    const c = data._counts||{}; dbg(`CRM: ${(data.leads||[]).length} leads total (instagram:${c.instagram||0} whatsapp:${c.whatsapp||0} shala:${c.shala||0}) + ${(data.converted||[]).length} converted`);
  }).catch(e => dbg('CRM bg refresh failed: ' + e.message));
}

function crmDetailHTML(c, editMode=false) {
  const isLead = c.db === 'leads';
  const statusArr = Array.isArray(c.status) ? c.status : (c.status ? [c.status] : []);
  const leadStatuses = ['Followed + Engaged','Reached out','WARM: Booked a call OR asked for help','HOT: Past client/strong conversation','QUALIFIED TO BUY','SALE CLOSED','GHOSTED','TERMINATED','NOT GOOD FIT'];
  const convStatuses = ['Face2Face conversation','Responded','Phone call','Booked Venue','Rejected Ubuntu'];
  const statusOptions = isLead
    ? leadStatuses.map(s => `<option value="${s}" ${c.status===s?'selected':''}>${s}</option>`).join('')
    : convStatuses.map(s => `<option value="${s}" ${statusArr.includes(s)?'selected':''}>${s}</option>`).join('');
  const statusBadges = statusArr.map(s => `<span class="crm-badge ${statusClass(s)}">${s}</span>`).join(' ');

  const showPromote = isLead && (c.status === 'Reached out' || c.status === 'WARM: Booked a call OR asked for help' || c.status === 'HOT: Past client/strong conversation' || c.status === 'QUALIFIED TO BUY' || c.status === 'SALE CLOSED');

  if (editMode) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-family:'Libre Baskerville',serif;font-size:15px;font-weight:700;color:#221208;">Edit Contact</div>
        <button onclick="openCrmModal('${c.id}')" style="background:none;border:none;font-size:13px;cursor:pointer;color:#8B7355;font-family:'Libre Baskerville',serif;letter-spacing:.08em;text-transform:uppercase;">✕ Cancel</button>
      </div>
      <div class="fg"><label>Name</label><input type="text" id="edit-name" value="${c.name||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>Company</label><input type="text" id="edit-company" value="${c.company||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>Email</label><input type="text" id="edit-email" value="${c.email||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>Instagram</label><input type="text" id="edit-insta" value="${c.insta||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>WhatsApp</label><input type="text" id="edit-whatsapp" value="${c.whatsapp||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>Website</label><input type="text" id="edit-website" value="${c.website||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <div class="fg"><label>Location</label><input type="text" id="edit-location" value="${c.location||''}" style="width:100%;padding:8px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;"></div>
      <button class="ios-modal-close" style="margin-top:8px;" onclick="saveContactDetails('${c.id}','${c.db}')">Save Details</button>
    `;
  }

  const fields = [
    c.company    && ['Company', c.company],
    c.email      && ['Email', `<a href="mailto:${c.email}" style="color:#B8935A;">${c.email}</a>`],
    c.whatsapp   && ['WhatsApp', c.whatsapp],
    c.insta      && ['Instagram', c.insta],
    c.linkedin   && ['LinkedIn', c.linkedin],
    c.website    && ['Website', `<a href="${(c.website||'').startsWith('http')?c.website:'https://'+c.website}" target="_blank" style="color:#B8935A;">${c.website}</a>`],
    c.location   && ['Location', c.location],
    c.contact    && ['Contact', c.contact],
    c.reachedOutOn && c.reachedOutOn.length > 0 && ['Reached out on', c.reachedOutOn.map(r=>`<span class="crm-badge crm-status-reached" style="font-size:7px;">${r}</span>`).join(' ')],
    c.engagedFirst && ['First contact', fmtD(c.engagedFirst)],
    c.engagedLast  && ['Last engaged', fmtD(c.engagedLast)],
    c.salesCall    && ['Sales call', fmtD(c.salesCall)],
  ].filter(Boolean).map(([l,v]) => `<div class="crm-field"><span class="crm-field-label">${l}</span><span>${v}</span></div>`).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
      <div>
        <div style="font-family:'Libre Baskerville',serif;font-size:15px;font-weight:700;color:#221208;">${c.name||'Unnamed'}</div>
        <div style="font-family:'Lora',serif;font-size:11px;color:#8B7355;margin-top:2px;">${isLead ? 'Lead Pipeline' : 'Converted Lead'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="openCrmModalEdit('${c.id}')" style="background:none;border:1px solid #D4C4A8;border-radius:3px;padding:5px 10px;font-family:'Libre Baskerville',serif;font-size:8px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;color:#8B7355;">✎ Edit</button>
        <button onclick="document.getElementById('crm-modal').classList.remove('open')" style="background:none;border:none;font-size:20px;cursor:pointer;color:#8B7355;">✕</button>
      </div>
    </div>
    ${fields || '<div style="color:#B8935A;font-family:Lora,serif;font-size:12px;font-style:italic;">No details available</div>'}
    <div class="crm-section-hd">Status</div>
    <div style="margin-bottom:8px;">${statusBadges || '—'}</div>
    ${isLead
      ? `<select class="crm-select" id="crm-status-sel">${statusOptions}</select>`
      : `<select class="crm-select" id="crm-status-sel" multiple size="3">${statusOptions}</select>`
    }
    <div class="crm-section-hd">Engage Next</div>
    <input type="date" id="crm-engage-next" value="${c.engageNext||''}" style="width:100%;padding:7px 10px;border:1px solid #D4C4A8;border-radius:3px;font-family:'Lora',serif;font-size:13px;background:#FDFAF5;outline:none;margin-bottom:8px;">
    <div class="crm-section-hd">Notes</div>
    <textarea class="crm-textarea" id="crm-notes-input">${c.notes||''}</textarea>
    <button class="ios-modal-close" style="margin-top:14px;" onclick="saveCrmContact('${c.id}','${c.db}')">Save Changes</button>
    ${showPromote ? `<button onclick="promoteLead('${c.id}')" style="width:100%;margin-top:8px;padding:10px;background:#3D6636;color:#fff;border:none;border-radius:4px;font-family:'Libre Baskerville',serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">→ Move to Converted</button>` : ''}
    <button onclick="prefillOfferFromCRM('${c.id}')" style="width:100%;margin-top:8px;padding:10px;background:#3a3228;color:#fff;border:none;border-radius:4px;font-family:'Libre Baskerville',serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">→ Create Offer</button>
    ${(() => {
      const linked = getLinkedDrafts(c.name, c.company);
      if (!linked.length) return '';
      return `<div class="crm-section-hd">Linked Drafts (${linked.length})</div>` +
        linked.map(d => `<div onclick="loadDraftById('${d.pageId}')" style="padding:8px 10px;border:1px solid #EDE3D4;border-radius:3px;margin-bottom:6px;cursor:pointer;background:#FDFAF5;font-family:'Lora',serif;font-size:11px;color:#1A1208;">
          <span style="font-weight:600;">${d.organizer||'Unnamed'}${d.retreatName?' · '+d.retreatName:''}</span>
          <span class="draft-status s-${d.status||'Draft'}" style="margin-left:6px;">${d.status||'Draft'}</span>
          <div style="font-size:10px;color:#8B7355;margin-top:2px;">${d.checkin?fmtD(d.checkin)+' → '+fmtD(d.checkout):'No dates'} · USD ${d.totalUSD?Number(d.totalUSD).toLocaleString('en-US'):'—'}</div>
        </div>`).join('');
    })()}
  `;
}

function openCrmModal(id) {
  const c = [...(crmData.leads||[]), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  $('crm-modal-content').innerHTML = crmDetailHTML(c, false);
  $('crm-modal').classList.add('open');
}

function openCrmModalEdit(id) {
  const c = [...(crmData.leads||[]), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  $('crm-modal-content').innerHTML = crmDetailHTML(c, true);
}

async function saveContactDetails(id, db) {
  const props = {};
  const name = $('edit-name')?.value;
  const company = $('edit-company')?.value;
  const email = $('edit-email')?.value;
  const insta = $('edit-insta')?.value;
  const whatsapp = $('edit-whatsapp')?.value;
  const website = $('edit-website')?.value;
  const location = $('edit-location')?.value;

  if (db === 'leads') {
    if (name !== undefined)    props['Name']     = { title:     [{ text: { content: name } }] };
    if (company !== undefined) props['Company']  = { rich_text: [{ text: { content: company } }] };
    if (email !== undefined)   props['Email']    = { email: email || null };
    if (insta !== undefined)   props['Insta']    = { rich_text: [{ text: { content: insta } }] };
    if (website !== undefined) props['Website']  = { rich_text: [{ text: { content: website } }] };
    if (location !== undefined)props['Location'] = { rich_text: [{ text: { content: location } }] };
  } else {
    if (name !== undefined)     props['Name']     = { title:     [{ text: { content: name } }] };
    if (company !== undefined)  props['Company']  = { rich_text: [{ text: { content: company } }] };
    if (email !== undefined)    props['Mail']     = { rich_text: [{ text: { content: email } }] };
    if (insta !== undefined)    props['Insta']    = { rich_text: [{ text: { content: insta } }] };
    if (whatsapp !== undefined) props['Whatsapp'] = { rich_text: [{ text: { content: whatsapp } }] };
    if (website !== undefined)  props['Website']  = { rich_text: [{ text: { content: website } }] };
    if (location !== undefined) props['Location'] = { rich_text: [{ text: { content: location } }] };
  }

  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateDetails', pageId: id, props }) });
    // Update local cache
    const arr = db === 'leads' ? crmData.leads : crmData.converted;
    const item = arr.find(x => x.id === id);
    if (item) {
      if (name) item.name = name;
      if (company) item.company = company;
      if (email) item.email = email;
      if (insta) item.insta = insta;
      if (whatsapp) item.whatsapp = whatsapp;
      if (website) item.website = website;
      if (location) item.location = location;
    }
    openCrmModal(id);
    crmRender();
  } catch(e) { alert('Could not save details.'); }
}

async function promoteLead(id) {
  const c = [...(crmData.leads||[])].find(x => x.id === id);
  if (!c || !confirm(`Move ${c.name || 'this lead'} to Converted Leads?`)) return;
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'promote', pageId: id, name: c.name, company: c.company,
        email: c.email, insta: c.insta, website: c.website, location: c.location, notes: c.notes }) });
    $('crm-modal').classList.remove('open');
    crmData.leads = crmData.leads.filter(x => x.id !== id);
    crmRender();
    loadCRM(true);
  } catch(e) { alert('Could not promote lead.'); }
}

function closeCrmModal(e) {
  if (e.target === $('crm-modal')) $('crm-modal').classList.remove('open');
}

async function saveCrmContact(id, db) {
  const sel = $('crm-status-sel');
  const status = db === 'leads'
    ? sel.value
    : Array.from(sel.selectedOptions).map(o => o.value);
  const notes = $('crm-notes-input').value;
  const engageNext = $('crm-engage-next').value || null;

  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', pageId:id, db, status, notes, engageNext }) });
    // Update local data
    const arr = db === 'leads' ? crmData.leads : crmData.converted;
    const item = arr.find(x => x.id === id);
    if (item) { item.status = status; item.notes = notes; item.engageNext = engageNext; }
    $('crm-modal').classList.remove('open');
    crmRender();
  } catch(e) { alert('Could not save.'); }
}

function loadDraftById(pageId) {
  if (!window._drafts) return;
  const idx = window._drafts.findIndex(d => d.pageId === pageId);
  if (idx >= 0) { loadDraftByIndex(idx); document.getElementById('crm-modal').classList.remove('open'); }
}

function prefillOfferFromCRM(id) {
  const c = [...(crmData.leads||[]), ...(crmData.converted||[])].find(x => x.id === id);
  if (!c) return;
  $('crm-modal').classList.remove('open');
  intentionalDraft = true;
  currentPageId = null;
  draftActive = false;
  $('f-name').value = c.name || '';
  $('f-company').value = c.company || '';
  $('f-contractdate').value = todayStr();
  $('f-validuntil').value = addDays(todayStr(), 7);
  $('notion-status').value = 'Draft';
  switchTab('edit');
}

function openNewLeadModal() {
  ['nl-name','nl-company','nl-email','nl-insta','nl-location','nl-notes'].forEach(id => { const el=$(id); if(el) el.value=''; });
  $('new-lead-modal').classList.add('open');
}

function closeNewLeadModal(e) {
  if (!e || e.target === $('new-lead-modal')) $('new-lead-modal').classList.remove('open');
}

async function saveNewLead() {
  const name = $('nl-name').value.trim();
  if (!name) { alert('Name is required.'); return; }
  try {
    await fetch('/api/crm', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action: 'create',
        name, company: $('nl-company').value,
        email: $('nl-email').value,
        insta: $('nl-insta').value,
        whatsapp: $('nl-whatsapp')?.value||'',
        location: $('nl-location').value,
        notes: $('nl-notes').value,
        source: $('nl-source').value,
      })
    });
    $('new-lead-modal').classList.remove('open');
    crmLoaded = false;
    loadCRM();
  } catch(e) { alert('Could not save lead.'); }
}
