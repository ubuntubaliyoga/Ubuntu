const $=id=>document.getElementById(id);
const fmtN=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtD=s=>{if(!s)return'';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});};
const fmtDS=s=>{if(!s)return'___________';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});};
const todayStr=()=>new Date().toISOString().split('T')[0];
const addDays=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];};
const addMonths=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setMonth(d.getMonth()+n);return d.toISOString().split('T')[0];};

let activeTab='deal', activeDealTab='drafts';
let currentPageId=null, autosaveOn=false, autosaveInterval=null, draftActive=false, intentionalDraft=false;
// crmData, crmTab, crmLoaded declared in crm.js — do NOT redeclare here

window.onerror=(msg,src,line)=>{dbg('ERR: '+msg+' ('+String(src).split('/').pop()+':'+line+')');};
window.onunhandledrejection=e=>{dbg('PROMISE ERR: '+(e.reason?.message||e.reason||'?'));};

function dbg(msg){
  const l=$('debug-log');if(!l)return;
  const t=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  l.innerHTML+=`<div>[${t}] ${msg}</div>`;
  const p=$('debug-panel');if(p)p.scrollTop=p.scrollHeight;
}

function toggleDebug(){
  const p=$('debug-panel');
  if(p)p.style.display=p.style.display==='block'?'none':'block';
  const d=$('nav-dropdown');if(d)d.classList.remove('open');
}

function toggleNavMenu(){
  const d=$('nav-dropdown');
  if(d)d.classList.toggle('open');
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#main-nav')){
    const d=$('nav-dropdown');
    if(d)d.classList.remove('open');
  }
});

function switchTab(t){
  activeTab=t;
  ['deal','crm','bizdev','philosophy','tutorials'].forEach(v=>{
    const el=$('view-'+v);
    if(el)el.classList.toggle('active',v===t);
  });
  document.querySelectorAll('.nav-tab[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  const tb=$('deal-toolbar');
  if(tb)tb.classList.toggle('visible',t==='deal');
  if(t==='deal')switchDealTab(activeDealTab);
  if(t==='crm'){
    if(typeof loadCRM==='function') loadCRM();
    if(typeof crmSwitchTab==='function') crmSwitchTab(typeof crmTab!=='undefined'?crmTab:'cold');
  }
  const d=$('nav-dropdown');if(d)d.classList.remove('open');
}

function switchDealTab(t){
  activeDealTab=t;
  ['drafts','edit','offer','contract'].forEach(v=>{
    const el=$('sub-view-'+v);
    if(el)el.style.display=v===t?'block':'none';
  });
  document.querySelectorAll('.deal-sub-tab').forEach(b=>{
    b.classList.toggle('active',b.id==='sub-'+t);
  });
  if(t==='offer')renderOffer();
  if(t==='contract')renderContract();
  if(t==='drafts'){loadDrafts();intentionalDraft=false;draftActive=false;}
}

function toggleVilla(n){
  $(`${n}-fields`).classList.toggle('disabled',!$(`f-${n}-on`).checked);
}
function toggleAutosave(){}

function startAutosave(){
  if(autosaveOn)return;
  autosaveOn=true;
  const s=$('autosave-status');
  if(s)s.style.display='inline';
  autosaveInterval=setInterval(async()=>{
    await saveToNotion(true);
    if(s)s.textContent='saved '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  },15000);
}

function markDraftActive(){
  if(!intentionalDraft)return;
  if(!draftActive){draftActive=true;startAutosave();}
}

function newDraftFromLead(leadId, leadName) {
  window._linkedLeadId = leadId;
  window._linkedLeadName = leadName;
  document.getElementById('crm-modal')?.classList.remove('open');
  switchTab('deal');
  newDraft();
  const el = $('f-name');
  if (el) { el.value = leadName; markDraftActive(); }
}

function newDraft(){
  window._linkedLeadId = null;
  window._linkedLeadName = null;
  currentPageId=null;
  ['f-name','f-company','f-address','f-phone','f-website','f-title','f-checkin','f-checkout','f-retreatname'].forEach(id=>{
    const el=$(id);if(el)el.value='';
  });
  $('f-contractdate').value=todayStr();
  $('f-validuntil').value=addDays(todayStr(),7);
  $('f-offervalid').value='';
  $('notion-status').value='Draft';
  draftActive=false;intentionalDraft=true;
  autosaveOn=false;clearInterval(autosaveInterval);autosaveInterval=null;
  const s=$('autosave-status');if(s)s.textContent='';
  if(typeof extraServices!=='undefined'){extraServices=[];renderExtraServices();}
  switchDealTab('edit');
}

let deferredPrompt=null;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
if(!isStandalone){
  if(isIOS){const b=$('install-btn');if(b)b.style.display='flex';}
  else window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();deferredPrompt=e;
    const b=$('install-btn');if(b)b.style.display='flex';
  });
}
function handleInstall(){
  if(isIOS)document.getElementById('ios-modal').classList.add('open');
  else if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>{deferredPrompt=null;const b=$('install-btn');if(b)b.style.display='none';});}
}

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    reg.addEventListener('updatefound',()=>{
      const sw=reg.installing;
      sw.addEventListener('statechange',()=>{
        if(sw.state==='installed'&&navigator.serviceWorker.controller){
          const b=$('update-btn');if(b)b.style.display='block';
        }
      });
    });
  });
}
function applyUpdate(){window.location.reload(true);}

$('f-contractdate').value=todayStr();
$('f-validuntil').value=addDays(todayStr(),7);
window.addEventListener('load',()=>switchTab('deal'));

(async()=>{
  const dot=$('idr-dot'),info=$('idr-info');
  try{
    const r=await fetch('/api/exchange-rate');
    const d=await r.json();
    $('f-idrrate').value=d.rate;
    const now=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    if(d.fallback){dot.className='idr-dot fallback';info.textContent=`⚠ Fallback rate · ${now}`;}
    else{dot.className='idr-dot live';info.textContent=`Live · ${now}`;}
  }catch{
    if(dot)dot.className='idr-dot error';
    if(info)info.textContent='Could not fetch — using default rate';
  }
})();

function toggleMoreDetails(btn){
  const details=btn.nextElementSibling;
  const open=details.style.display!=='none';
  details.style.display=open?'none':'block';
  btn.textContent=open?btn.textContent.replace('− ','+ '):btn.textContent.replace('+ ','− ');
}
