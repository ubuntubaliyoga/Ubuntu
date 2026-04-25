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
      list.innerHTML=`<div style="text-align:center;padding:60px 0;color:var(--muted);font-size:13px;font-style:italic;">No drafts saved yet. Tap + to create your first deal.</div>`;
      return;
    }
    window._drafts=_parseDraftLinks(data.drafts);
    list.innerHTML=data.drafts.map((d,i)=>{
      const hasState=d.formState&&d.formState!=='null';
      const dateStr=d.checkin?fmtD(d.checkin)+' → '+fmtD(d.checkout):'No dates';
      const total=d.totalUSD?'USD '+Number(d.totalUSD).toLocaleString('en-US',{minimumFractionDigits:0}):'—';
      const onclick=hasState?`loadDraftByIndex(${i})`:'';
      return`<div class="draft-card" id="draft-card-${i}" ${onclick?`onclick="${onclick}"`:'style="opacity:.6;cursor:default;"'}>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="min-width:0;flex:1;">
            <div class="draft-name">${d.organizer||'Unnamed'}${d.retreatName?`<span style="font-weight:400;color:var(--muted);"> · ${d.retreatName}</span>`:''}</div>
            <div class="draft-meta" style="margin-top:4px;">${dateStr} &nbsp;·&nbsp; ${total}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <span class="draft-status s-${d.status||'Draft'}">${d.status||'Draft'}</span>
            <button class="draft-more-btn" onclick="event.stopPropagation();toggleDraftMenu(${i})">···</button>
          </div>
        </div>
        <div class="draft-more-menu" id="draft-menu-${i}">
          <button onclick="event.stopPropagation();toggleRenameRow(${i})">✎ Rename</button>
          ${hasState?`<button onclick="event.stopPropagation();duplicateDraft(${i})">⧉ Duplicate</button>`:''}
          <button onclick="event.stopPropagation();deleteDraft(${i})" style="color:#B71C1C;">Delete</button>
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

function toggleDraftMenu(i){
  document.querySelectorAll('.draft-more-menu').forEach((m,idx)=>{
    m.classList.toggle('open',idx===i&&!m.classList.contains('open'));
  });
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.draft-more-btn')&&!e.target.closest('.draft-more-menu')){
    document.querySelectorAll('.draft-more-menu').forEach(m=>m.classList.remove('open'));
  }
});

function loadDraftByIndex(i){
  try{
    const d=window._drafts[i];
    if(!d||!d.formState) return;
    setFormState(JSON.parse(d.formState));
    // Migrate legacy meal text
    const _fi=$('f-included');
    if(_fi)_fi.value=_fi.value.replace(/2 organic meals per day/g,'2 plant based meals per day');
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
  if(window._templateMode){if(!silent)showTemplateConfirm();return;}
  const btn=$('save-btn');
  if(!silent){btn.textContent='Saving…';btn.className='save-btn';}
  const formState=JSON.stringify(getFormState());
  // Autosave: only persist formState when the page already exists
  if(silent&&currentPageId){
    dbg(`autosave | formState=${formState.length} chars | pageId=${currentPageId}`);
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>{dbg('ABORT: 15s timeout hit');controller.abort();},15000);
      const r=await fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'autosave',pageId:currentPageId,formState}),signal:controller.signal});
      clearTimeout(timeout);
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'HTTP '+r.status);
      dbg('autosave SUCCESS ✓');
    } catch(err){
      const msg=err.name==='AbortError'?'Timeout':(err.message||'Error');
      dbg(`autosave ERROR: ${msg}`);
    }
    return;
  }
  const P=pricing();
  const payload={
    organizer:$('f-name').value,retreatName:$('f-retreatname').value,
    checkin:$('f-checkin').value,checkout:$('f-checkout').value,
    contractDate:$('f-contractdate').value||todayStr(),
    rooms:P.bales+(P.parvOn?1:0)+(P.buddOn?1:0),
    nights:P.nights,guests:parseInt($('f-guests').value)||0,
    totalUSD:P.totalIn,status:$('notion-status').value,
    formState,
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

const OFFER_STYLES=`@page{size:A4 portrait;margin:18mm 22mm;}*{box-sizing:border-box;}body{margin:0;padding:0;background:#FDFCFB;color:#3D3935;font-family:'Montserrat',sans-serif;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.email{width:100%;max-width:100%;margin:0;}.e-header{background:#FDFCFB;text-align:center;padding:22px 0 16px;border-bottom:1px solid #E2D9CE;}.e-logo{max-width:46px;margin:0 auto 13px;display:block;opacity:.9;}.e-header-label{font-family:'Cormorant Garamond',serif;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#C5A27D;margin-bottom:5px;font-weight:400;}.e-header-line{width:34px;height:1px;background:#C5A27D;margin:7px auto;opacity:.55;}.e-header-date,.e-header-dates{font-size:8px;color:#9E948A;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase;}.e-body{padding:18px 0 4px;line-height:2;color:#3D3935;font-size:10px;}.e-body p{margin-bottom:9px;}.e-badge{margin:12px 0 0;background:#FAF6F0;border:1px solid #C5A27D;border-radius:2px;padding:8px 12px;text-align:center;font-size:8.5px;color:#7A6248;letter-spacing:.4px;}.e-package{margin:18px 0 0;}.e-pkg-hd{padding-bottom:10px;border-bottom:2px solid #C5A27D;}.e-pkg-hd-label{font-size:7px;letter-spacing:3px;text-transform:uppercase;color:#C5A27D;margin-bottom:4px;font-family:'Montserrat',sans-serif;font-weight:500;}.e-pkg-hd-title{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:600;color:#3D3935;letter-spacing:.02em;line-height:1.2;}.e-pkg-hd-sub{font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:#9E948A;margin-top:3px;}.e-pkg-body{padding:0 0 14px;}table.ptable{width:100%;border-collapse:collapse;font-size:9px;font-family:'Montserrat',sans-serif;}.pt-colhead td{padding:10px 0 5px;font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#B5AAA0;border-bottom:1px solid #E8E2DA;}.pt-item td{padding:7px 0;border-bottom:1px solid #F0EBE3;}.pt-subtotal td{padding:6px 0 3px;border-top:1px solid #D8D0C4;font-size:8px;letter-spacing:.5px;color:#9E948A;text-transform:uppercase;}.pt-discount td{padding:4px 0;font-size:8.5px;color:#C5A27D;}.pt-total td{padding:8px 0 3px;border-top:2px solid #3D3935;font-weight:600;font-size:9.5px;}.pt-taxnote td{padding:1px 0 8px;font-size:7.5px;color:#B5AAA0;letter-spacing:.3px;}.pt-divider td{padding:2px 0 5px;}.pt-divline{height:1px;background:#F0EBE3;}.pt-grand td{padding:3px 0;font-weight:700;font-size:10px;}.pt-grandnote td{padding:2px 0 8px;font-size:7.5px;color:#B5AAA0;}.col-item{width:52%;}.col-rate{width:26%;text-align:right;padding-right:12px!important;}.col-sub{width:22%;text-align:right;}.rate-orig{display:block;color:#C0B8B0;font-size:8px;text-decoration:line-through;}.rate-disc{display:block;color:#3D3935;font-weight:500;}.rate-pct{display:inline-block;color:#C5A27D;font-size:7.5px;margin-left:3px;}.e-investment{background:#FAF6F0;border:1px solid #E2D9CE;border-radius:2px;padding:12px 16px 14px;margin-top:12px;page-break-inside:avoid;}.e-invest-row{display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;font-size:9px;color:#6A5E54;}.e-invest-section-label{font-size:7px;letter-spacing:2.5px;text-transform:uppercase;color:#C5A27D;padding-top:9px;padding-bottom:1px;}.e-invest-addon{font-size:8.5px;color:#8A7E74;padding:2px 0;}.e-invest-addon-total{font-weight:500;color:#3D3935;border-top:1px solid #E2D9CE;margin-top:3px;padding-top:7px!important;}.e-invest-grand{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 3px;border-top:1px solid #C5A27D;margin-top:9px;}.e-invest-grand-lbl{font-family:'Cormorant Garamond',serif;font-size:14px;font-weight:600;color:#3D3935;}.e-invest-grand-val{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;color:#3D3935;}.e-invest-grand-sub{font-size:7px;color:#B5AAA0;letter-spacing:.4px;margin-top:1px;}.e-invest-note{font-size:7px;color:#B5AAA0;text-align:right;letter-spacing:.5px;margin-top:2px;}.e-note{margin:14px 0 0;padding:8px 12px;line-height:1.9;color:#6A5E54;font-size:9px;border-left:2px solid #C5A27D;background:#FAF6F0;}.e-note p{margin-bottom:4px;}.e-included{margin:16px 0 0;padding:12px 16px 8px;border:1px solid #E2D9CE;border-radius:2px;page-break-inside:avoid;}.e-included-label{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:#3D3935;margin-bottom:7px;}.e-included table{width:100%;border-collapse:collapse;font-size:8.5px;}.e-included td{padding:3px 0;vertical-align:top;width:50%;color:#6A5E54;line-height:1.7;}.e-also{margin:14px 0 0;}.e-also-label{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:#3D3935;margin-bottom:7px;}.e-also p{padding:2px 0;line-height:1.8;font-size:8.5px;color:#6A5E54;}.e-closing{padding:20px 0 0;line-height:2;font-size:10px;color:#3D3935;page-break-inside:avoid;}.e-closing p{margin-bottom:5px;}.e-footer-band{background:#3D3935!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-top:28px;padding:16px 0 20px;text-align:center;page-break-inside:avoid;}.e-footer-tagline{font-family:'Cormorant Garamond',serif;font-size:10px;font-style:italic;color:#C5A27D!important;margin-bottom:5px;letter-spacing:1px;}.e-footer-contact{font-size:7.5px;color:#9A8878;line-height:2;letter-spacing:.5px;}`;
const CONTRACT_STYLES=`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Lora',serif;background:#F0E9DF;padding:20px;color:#1A1208;}@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap');.contract-doc{background:#fff;border:1px solid #D4C4A8;border-radius:6px;padding:40px 36px;font-family:'Lora',serif;color:#1A1208;font-size:12.5px;line-height:1.75;}.c-hd{text-align:center;margin-bottom:26px;border-bottom:2px solid #221208;padding-bottom:20px;}.c-hd-title{font-family:'Libre Baskerville',serif;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}.c-hd-sub{font-family:'Lora',serif;font-size:11px;color:#8B7355;font-style:italic;}.c-parties{display:grid;grid-template-columns:1fr 1fr;border:1px solid #B8935A;margin-bottom:22px;}.c-party{padding:13px 16px;background:#FDFAF5;}.c-party:first-child{border-right:1px solid #B8935A;}.c-party-title{font-family:'Libre Baskerville',serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5C3D2E;margin-bottom:8px;}.c-party p{font-size:11.5px;margin-bottom:3px;}.c-datebar{text-align:center;font-family:'Libre Baskerville',serif;font-size:10.5px;font-weight:700;border-top:1px solid #DDD0BA;border-bottom:1px solid #DDD0BA;padding:9px 0;margin-bottom:22px;color:#221208;}.c-validity{background:#F5ECD7;border:1px solid #C8A96E;border-radius:3px;padding:9px 14px;margin-bottom:22px;font-size:11.5px;color:#3D2B1F;line-height:1.65;}.c-sec{margin-bottom:20px;}.c-sec-hd{font-family:'Libre Baskerville',serif;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#221208;border-bottom:1.5px solid #B8935A;padding-bottom:4px;margin-bottom:11px;}.c-sec p{margin-bottom:7px;font-size:12px;}.c-sec ul{margin:0 0 9px 18px;font-size:12px;}.c-sec ul li{margin-bottom:3px;}.c-table{width:100%;border-collapse:collapse;font-size:11.5px;margin:9px 0;}.c-table thead tr{background:#221208;}.c-table thead th{padding:7px 11px;color:#F5ECD7;font-family:'Libre Baskerville',serif;font-size:8.5px;letter-spacing:.08em;text-align:left;font-weight:700;}.c-table tbody tr:nth-child(odd){background:#FDFAF5;}.c-table tbody tr:nth-child(even){background:#F5ECD7;}.c-table tbody td{padding:6px 11px;border-bottom:1px solid #EDE3D4;}.c-sigs{border-top:2px solid #221208;padding-top:22px;}.c-sigs-title{font-family:'Libre Baskerville',serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;text-align:center;margin-bottom:22px;}.c-sigs-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;}.c-sig-party{font-family:'Libre Baskerville',serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5C3D2E;margin-bottom:10px;}.c-sig-line{border-bottom:1px solid #1A1208;width:80%;height:20px;margin:16px 0 5px;}.c-sig-note{font-size:10.5px;color:#8B7355;font-style:italic;font-family:'Lora',serif;}.bank-table{border-collapse:collapse;font-size:11.5px;margin:7px 0 9px;}.bank-table td{padding:4px 18px 4px 0;font-family:'Lora',serif;}.bank-table td:first-child{font-weight:700;font-family:'Libre Baskerville',serif;font-size:9.5px;letter-spacing:.05em;white-space:nowrap;}@media print{body{padding:0;}}`;

function printOffer(){const w=window.open('','_blank');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ubuntu Bali – Offer</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet"><style>${OFFER_STYLES}</style></head><body><div class="email">${buildOfferHTML()}</div><script>document.fonts.ready.then(function(){window.print();});<\/script>
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
