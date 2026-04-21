function _parseDraftLinks(drafts) {
  return drafts.map(d => {
    try {
      const s = d.formState ? JSON.parse(d.formState) : {};
      d.linkedLeadId = s['_linkedLeadId'] || null;
      d.linkedLeadName = s['_linkedLeadName'] || null;
    } catch(e) {}
    return d;
  });
}

async function fetchDraftsData() {
  try {
    const r = await fetch('/api/notion', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'load'}) });
    if (!r.ok) return;
    const data = await r.json();
    window._drafts = _parseDraftLinks(data.drafts || []);
  } catch(e) { /* silent — CRM still works without draft data */ }
}

async function loadDrafts(){
  const list=$('drafts-list');
  if(!list) return;
  list.innerHTML=`<div style="text-align:center;padding:60px 0;color:var(--muted);font-size:13px;font-style:italic;">Loading drafts…</div>`;
  try{
    const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load'})});
    if(!r.ok) throw new Error();
    const data=await r.json();
    if(!data.drafts||data.drafts.length===0){
      list.innerHTML=`<div style="text-align:center;padding:60px 0;color:var(--muted);font-size:13px;font-style:italic;">No drafts saved yet. Click + New Deal to start.</div>`;
      return;
    }
    window._drafts=_parseDraftLinks(data.drafts);
    list.innerHTML=data.drafts.map((d,i)=>{
      const hasState=d.formState&&d.formState!=='null';
      const dateStr=d.checkin?fmtD(d.checkin)+' → '+fmtD(d.checkout):'No dates set';
      const total=d.totalUSD?'USD '+Number(d.totalUSD).toLocaleString('en-US',{minimumFractionDigits:0}):'—';
      const edited=d.lastEdited?new Date(d.lastEdited).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
      return`<div class="draft-card" id="draft-card-${i}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;">
          <div class="draft-name">${d.organizer||'Unnamed'}${d.retreatName?` · ${d.retreatName}`:''}</div>
          <span class="draft-status s-${d.status||'Draft'}" style="flex-shrink:0;">${d.status||'Draft'}</span>
        </div>
        <div class="draft-meta">${dateStr}</div>
        <div class="draft-meta">${d.nights||'?'} nights &nbsp;·&nbsp; ${d.guests||'?'} guests &nbsp;·&nbsp; ${total}</div>
        ${edited?`<div style="font-family:'Lora',serif;font-size:10px;color:#B8935A;margin-top:8px;font-style:italic;">Last edited: ${edited}</div>`:''}
        <div class="draft-actions">
          ${hasState?`<button class="draft-btn load" onclick="loadDraftByIndex(${i})">Load</button>`:`<span style="font-size:10px;color:#B8935A;font-family:'Lora',serif;font-style:italic;">No state</span>`}
          <button class="draft-btn ghost" onclick="toggleRenameRow(${i})" title="Rename">✎ Rename</button>
          ${hasState?`<button class="draft-btn ghost" onclick="duplicateDraft(${i})" title="Duplicate">⧉ Duplicate</button>`:''}
          <button class="draft-btn ghost" onclick="deleteDraft(${i})" title="Delete">🗑 Delete</button>
        </div>
        <div class="draft-edit-row" id="rename-row-${i}">
          <input class="draft-edit-input" id="rename-input-${i}" placeholder="Organizer name" value="${d.organizer||''}">
          <input class="draft-edit-input" id="rename-retreat-${i}" placeholder="Retreat name" value="${d.retreatName||''}">
          <button class="draft-edit-btn confirm" onclick="confirmRename(${i})">Save</button>
          <button class="draft-edit-btn cancel" onclick="toggleRenameRow(${i})">Cancel</button>
        </div>
      </div>`;
    }).join('');
  } catch(e){
    dbg('loadDrafts error: ' + e.message);
    list.innerHTML=`<div style="text-align:center;padding:60px 0;color:var(--muted);font-size:13px;">Could not load drafts: ${e.message}</div>`;
  }
}

function loadDraftByIndex(i){
  try{
    const d=window._drafts[i];
    if(!d||!d.formState) return;
    setFormState(JSON.parse(d.formState));
    currentPageId=d.pageId;
    draftActive=true;
    intentionalDraft=true;
    startAutosave();
    switchDealTab('edit');
  } catch(e){alert('Could not load this draft.');}
}

function toggleRenameRow(i){
  const row=$(`rename-row-${i}`);
  row.classList.toggle('open');
  if(row.classList.contains('open')) $(`rename-input-${i}`).focus();
}

async function confirmRename(i){
  const d=window._drafts[i];
  if(!d) return;
  try{
    const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      action:'update',pageId:d.pageId,
      organizer:$(`rename-input-${i}`).value.trim()||d.organizer,
      retreatName:$(`rename-retreat-${i}`).value.trim()||d.retreatName,
      checkin:d.checkin,checkout:d.checkout,nights:d.nights,
      guests:d.guests,totalUSD:d.totalUSD,status:d.status,formState:d.formState,
    })});
    if(!r.ok) throw new Error();
    loadDrafts();
  } catch{alert('Could not rename.');}
}

async function duplicateDraft(i){
  const d=window._drafts[i];
  if(!d||!d.formState) return;
  try{
    const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      action:'create',organizer:(d.organizer||'')+' (copy)',retreatName:d.retreatName,
      checkin:d.checkin,checkout:d.checkout,nights:d.nights,
      guests:d.guests,totalUSD:d.totalUSD,status:'Draft',formState:d.formState,
    })});
    if(!r.ok) throw new Error();
    loadDrafts();
  } catch{alert('Could not duplicate.');}
}

async function deleteDraft(i){
  const d=window._drafts[i];
  if(!d||!confirm(`Move "${d.organizer||'this draft'}" to trash?`)) return;
  try{
    const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',pageId:d.pageId})});
    if(!r.ok) throw new Error();
    if(currentPageId===d.pageId) currentPageId=null;
    loadDrafts();
  } catch{alert('Could not delete.');}
}

function dbg(msg){
  const p=$('debug-panel'),l=$('debug-log');
  if(!p||!l)return;
  const t=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  l.innerHTML+=`<div>[${t}] ${msg}</div>`;
  p.scrollTop=p.scrollHeight;
}

async function saveToNotion(silent=false){
  const btn=$('save-btn');
  if(!silent){btn.textContent='Saving…';btn.className='save-btn';}
  const P=pricing();
  const payload={
    organizer:$('f-name').value,retreatName:$('f-retreatname').value,
    checkin:$('f-checkin').value,checkout:$('f-checkout').value,
    contractDate:$('f-contractdate').value||todayStr(),
    rooms:P.bales+(P.parvOn?1:0)+(P.buddOn?1:0),
    nights:P.nights,guests:parseInt($('f-guests').value)||0,
    totalUSD:P.totalIn,status:$('notion-status').value,
    formState:JSON.stringify(getFormState()),
  };
  const action=currentPageId?'update':'create';
  const fsLen=payload.formState.length;
  dbg(`action=${action} | formState=${fsLen} chars | pageId=${currentPageId||'none'}`);
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>{dbg('ABORT: 15s timeout hit');controller.abort();},15000);
    const body=currentPageId
      ?JSON.stringify({action:'update',...payload,pageId:currentPageId})
      :JSON.stringify({action:'create',...payload});
    dbg(`fetching /api/notion...`);
    const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
    clearTimeout(timeout);
    dbg(`response status: ${r.status}`);
    const data=await r.json();
    dbg(`response body: ${JSON.stringify(data).slice(0,200)}`);
    if(!r.ok) throw new Error(data.error||'HTTP '+r.status);
    if(!currentPageId&&data.pageId) currentPageId=data.pageId;
    dbg('SUCCESS ✓');
    if(!silent){btn.textContent='✓ Saved';btn.className='save-btn saved';setTimeout(()=>{btn.textContent='Save';btn.className='save-btn';},3000);}
  } catch(err){
    const msg=err.name==='AbortError'?'Timeout':(err.message||'Error');
    dbg(`ERROR: ${msg}`);
    if(!silent){btn.textContent='✗ '+msg;btn.className='save-btn error';btn.title=msg;setTimeout(()=>{btn.textContent='Save';btn.className='save-btn';btn.title='';},6000);}
  }
}

const OFFER_STYLES=`body{font-family:Verdana,Geneva,sans-serif;font-size:10px;background:#e8e3dc;margin:0;padding:16px;color:#2a2520;}.email{background:#fff;width:560px;margin:0 auto;}.e-header{background:#3a3228;text-align:center;padding:22px 32px 18px;}.e-logo{max-width:56px;margin:0 auto 11px;display:block;filter:brightness(0) invert(1);}.e-header-label{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#c8b89a;margin-bottom:4px;}.e-header-line{width:34px;height:1px;background:#c8b89a;margin:6px auto;opacity:.6;}.e-header-date,.e-header-dates{font-size:9px;color:#c8b89a;margin-top:3px;}.e-body{padding:16px 32px 0;line-height:1.9;color:#2a2520;}.e-body p{margin-bottom:9px;}.e-badge{margin:11px 32px 0;background:#f7f2ec;border:1px solid #c8b89a;border-radius:4px;padding:7px 12px;text-align:center;font-size:10px;color:#3a3228;}.e-package{margin:13px 32px 0;border:1px solid #d8d0c4;border-radius:4px;overflow:hidden;}.e-pkg-hd{background:#3a3228;padding:10px 14px;}.e-pkg-hd-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#c8b89a;margin-bottom:3px;}.e-pkg-hd-title{font-size:11px;font-weight:bold;color:#fff;}.e-pkg-body{padding:0 14px;}table.ptable{width:100%;border-collapse:collapse;font-size:10px;}.pt-colhead td{padding:7px 0 3px;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#999;}.pt-item td{padding:5px 0;border-top:1px solid #eee;}.pt-subtotal td{padding:5px 0;border-top:1px solid #d8d0c4;font-style:italic;color:#777;}.pt-discount td{padding:5px 0;border-top:1px solid #eee;color:#7a6a52;}.pt-total td{padding:7px 0 2px;border-top:2px solid #3a3228;font-weight:bold;}.pt-taxnote td{padding:2px 0 8px;font-size:9px;color:#888;}.pt-divider td{padding:0 0 5px;}.pt-divline{height:1px;background:#eee;font-size:1px;}.pt-grand td{padding:2px 0;font-weight:bold;}.pt-grandnote td{padding:2px 0 9px;font-size:9px;color:#888;}.col-item{width:50%}.col-rate{width:25%;text-align:center}.col-sub{width:25%;text-align:right}.e-note{margin:9px 32px 0;border-left:3px solid #c8b89a;padding:5px 10px;line-height:1.8;color:#4a3e34;font-size:10px;background:#faf7f3;}.e-note p{margin-bottom:5px;}.e-included{margin:13px 32px 0;border:1px solid #d8d0c4;border-radius:4px;padding:10px 14px 6px;}.e-included-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#7a6a52;margin-bottom:7px;}.e-included table{width:100%;border-collapse:collapse;font-size:10px;}.e-included td{padding:2px 0;vertical-align:top;width:50%;}.e-also{margin:13px 32px 0;}.e-also-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#7a6a52;margin-bottom:7px;}.e-also p{padding:2px 0;line-height:1.8;font-size:10px;}.e-closing{padding:18px 32px 0;line-height:1.9;font-size:10px;}.e-closing p{margin-bottom:5px;}.e-footer-band{background:#3a3228;margin-top:24px;padding:14px 32px 18px;text-align:center;}.e-footer-tagline{font-size:9px;font-style:italic;color:#c8b89a;margin-bottom:5px;letter-spacing:1px;}.e-footer-contact{font-size:9px;color:#a89880;line-height:1.8;}@media print{body{padding:0;}}`;
const CONTRACT_STYLES=`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Lora',serif;background:#F0E9DF;padding:20px;color:#1A1208;}@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap');.contract-doc{background:#fff;border:1px solid #D4C4A8;border-radius:6px;padding:40px 36px;font-family:'Lora',serif;color:#1A1208;font-size:12.5px;line-height:1.75;}.c-hd{text-align:center;margin-bottom:26px;border-bottom:2px solid #221208;padding-bottom:20px;}.c-hd-title{font-family:'Libre Baskerville',serif;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}.c-hd-sub{font-family:'Lora',serif;font-size:11px;color:#8B7355;font-style:italic;}.c-parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #B8935A;margin-bottom:22px;}.c-party{padding:13px 16px;background:#FDFAF5;}.c-party:first-child{border-right:1px solid #B8935A;}.c-party-title{font-family:'Libre Baskerville',serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5C3D2E;margin-bottom:8px;}.c-party p{font-size:11.5px;margin-bottom:3px;}.c-datebar{text-align:center;font-family:'Libre Baskerville',serif;font-size:10.5px;font-weight:700;border-top:1px solid #DDD0BA;border-bottom:1px solid #DDD0BA;padding:9px 0;margin-bottom:22px;color:#221208;}.c-validity{background:#F5ECD7;border:1px solid #C8A96E;border-radius:3px;padding:9px 14px;margin-bottom:22px;font-size:11.5px;color:#3D2B1F;line-height:1.65;}.c-sec{margin-bottom:20px;}.c-sec-hd{font-family:'Libre Baskerville',serif;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#221208;border-bottom:1.5px solid #B8935A;padding-bottom:4px;margin-bottom:11px;}.c-sec p{margin-bottom:7px;font-size:12px;}.c-sec ul{margin:0 0 9px 18px;font-size:12px;}.c-sec ul li{margin-bottom:3px;}.c-table{width:100%;border-collapse:collapse;font-size:11.5px;margin:9px 0;}.c-table thead tr{background:#221208;}.c-table thead th{padding:7px 11px;color:#F5ECD7;font-family:'Libre Baskerville',serif;font-size:8.5px;letter-spacing:.08em;text-align:left;font-weight:700;}.c-table tbody tr:nth-child(odd){background:#FDFAF5;}.c-table tbody tr:nth-child(even){background:#F5ECD7;}.c-table tbody td{padding:6px 11px;border-bottom:1px solid #EDE3D4;}.c-sigs{border-top:2px solid #221208;padding-top:22px;}.c-sigs-title{font-family:'Libre Baskerville',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;text-align:center;margin-bottom:22px;}.c-sigs-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;}.c-sig-party{font-family:'Libre Baskerville',serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5C3D2E;margin-bottom:10px;}.c-sig-line{border-bottom:1px solid #1A1208;width:80%;height:20px;margin:16px 0 5px;}.c-sig-note{font-size:10.5px;color:#8B7355;font-style:italic;font-family:'Lora',serif;}.bank-table{border-collapse:collapse;font-size:11.5px;margin:7px 0 9px;}.bank-table td{padding:4px 18px 4px 0;font-family:'Lora',serif;}.bank-table td:first-child{font-weight:700;font-family:'Libre Baskerville',serif;font-size:9.5px;letter-spacing:.05em;white-space:nowrap;}@media print{body{padding:0;}}`;

function printOffer(){const w=window.open('','_blank');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ubuntu Bali – Offer</title><style>${OFFER_STYLES}</style></head><body><div class="email">${buildOfferHTML()}</div><script>window.onload=function(){window.print();}<\/script>
</body></html>`);w.document.close();}
function printContract(){const w=window.open('','_blank');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ubuntu Bali – Contract</title><link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet"><style>${CONTRACT_STYLES}</style></head><body>${buildContractHTML()}<script>window.onload=function(){window.print();}<\/script>
</body></html>`);w.document.close();}


// Service worker
let pendingSW = null;
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    reg.addEventListener('updatefound',()=>{
      const sw=reg.installing;
      sw.addEventListener('statechange',()=>{
        if(sw.state==='installed' && navigator.serviceWorker.controller){
          pendingSW = sw;
          $('update-btn').style.display='block';
        }
      });
    });
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')
      navigator.serviceWorker.getRegistration().then(reg=>{if(reg)reg.update();});
  });
}
function applyUpdate(){
  window.location.reload(true);
}




// Global error capture → debug panel
window.onerror = function(msg, src, line, col, err) {
  dbg('ERROR: ' + msg + ' (' + (src||'').split('/').pop() + ':' + line + ')');
};
window.onunhandledrejection = function(e) {
  dbg('PROMISE ERROR: ' + (e.reason?.message || e.reason || 'unknown'));
};
