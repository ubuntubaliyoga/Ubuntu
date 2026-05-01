const $=id=>document.getElementById(id);
const fmtN=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtD=s=>{if(!s)return'';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});};
const fmtDS=s=>{if(!s)return'___________';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});};
const todayStr=()=>new Date().toISOString().split('T')[0];
const addDays=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];};
const addMonths=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setMonth(d.getMonth()+n);return d.toISOString().split('T')[0];};

let activeTab='deal', activeDealTab='drafts';
let currentPageId=null, autosaveOn=false, autosaveInterval=null, draftActive=false, intentionalDraft=false;
window._templateMode=false;
window._contractTemplateMode=false;
const TEMPLATE_FIELDS=['f-intro','f-body','f-included','f-also','f-signoff','f-signoff2','f-note','f-roomrate','f-pkgrate','f-deposit'];
// crmData, crmTab, crmLoaded declared in crm.js — do NOT redeclare here

window._errorLog=[];
window.onerror=(msg,src,line,col,error)=>{dbgStructured({type:'js',message:String(msg),file:String(src).split('/').pop(),line,col,stack:error?.stack||null});};
window.onunhandledrejection=e=>{const err=e.reason;dbgStructured({type:'promise',message:err?.message||String(err)||'?',stack:err?.stack||null});};

function dbg(msg){
  const l=$('debug-log');if(!l)return;
  const t=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  l.innerHTML+=`<div>[${t}] ${msg}</div>`;
  const p=$('debug-panel');if(p)p.scrollTop=p.scrollHeight;
}

function dbgWarn(msg){
  const l=$('debug-log');if(!l)return;
  const t=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  l.innerHTML+=`<div style="color:#ffaa00">[${t}] ${msg}</div>`;
  const p=$('debug-panel');if(p)p.scrollTop=p.scrollHeight;
}

let _agentOn=localStorage.getItem('debugAgentOn')!=='0';
function toggleAgent(){
  _agentOn=!_agentOn;
  localStorage.setItem('debugAgentOn',_agentOn?'1':'0');
  const btn=$('agent-toggle');
  if(btn){btn.textContent='AGENT: '+(_agentOn?'ON':'OFF');btn.classList.toggle('on',_agentOn);}
}
window.addEventListener('load',()=>{
  const btn=$('agent-toggle');
  if(btn){btn.textContent='AGENT: '+(_agentOn?'ON':'OFF');btn.classList.toggle('on',_agentOn);}

  // Schema drift check — at most once per 24h, runs 3s after load so it never blocks UI
  const lastCheck=parseInt(localStorage.getItem('driftCheckedAt')||'0');
  if(Date.now()-lastCheck>86400000){
    setTimeout(async()=>{
      try{
        const r=await fetch('/api/drift-detector');
        const d=await r.json();
        localStorage.setItem('driftCheckedAt',String(Date.now()));
        if(d.drifts?.length>0){
          const p=$('debug-panel');if(p)p.style.display='block';
          dbgWarn(`[DRIFT] ${d.drifts.length} schema issue(s) found — Notion properties changed`);
          d.drifts.forEach(dr=>dbgWarn(`[DRIFT] ${dr.db} · "${dr.property}" — ${dr.issue}`));
        }
      }catch{}
    },3000);
  }
});

// Client-side filename → repo path for JS errors
const _jsFileMap={'core.js':'js/core.js','drafts.js':'js/drafts.js','offer.js':'js/offer.js','crm.js':'js/crm.js','bizdev.js':'js/bizdev.js'};

function _agentPost(url, entry, onResult){
  fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)})
    .then(r=>r.json()).then(onResult)
    .catch(e=>dbg(`[AGENT] network error: ${e.message}`));
}

function _logResult(d, level){
  const p=level===2?'[AGENT-2]':'[AGENT]';
  if(d.action==='fixed')          dbg(`${p} fixed: ${d.file}`);
  else if(d.action==='pr_created')dbg(`${p} PR opened — review needed: ${d.pr}`);
  else if(d.action==='no_fix')    dbg(`${p} no fix: ${d.reason}`);
  else if(d.action==='skipped')   dbg(`${p} skipped: ${d.reason}`);
  else if(d.action==='circuit_open'){
    dbg(`${p} escalating to deep agent...`);
    _agentPost('/api/debug-agent-deep', d._entry||{}, r=>_logResult(r,2));
  }
  else dbg(`${p} ${JSON.stringify(d)}`);
}

function dbgStructured(obj){
  const entry={...obj,ts:Date.now(),tab:typeof activeTab!=='undefined'?activeTab:null};
  window._errorLog.push(entry);
  const loc=obj.file?` (${obj.file}:${obj.line||'?'})`:obj.url?` → ${obj.url}`:'';
  dbg(`[${(obj.type||'ERR').toUpperCase()}] ${obj.message||'?'}${loc}`);
  if(!_agentOn) return;

  // API errors with a Notion code → Level 1 first, escalate on circuit_open
  if(obj.type==='api'&&obj.notion_code){
    dbg('[AGENT] analyzing...');
    _agentPost('/api/debug-agent', entry, d=>{
      if(d.action==='circuit_open'){
        dbg('[AGENT] circuit open — escalating to deep agent...');
        _agentPost('/api/debug-agent-deep', entry, r=>_logResult(r,2));
      } else _logResult(d,1);
    });
    return;
  }

  // API errors without a Notion code (generic 500s, server crashes) → deep agent directly
  if(obj.type==='api'&&!obj.notion_code){
    dbg('[AGENT-2] API error — analyzing...');
    _agentPost('/api/debug-agent-deep', entry, r=>_logResult(r,2));
    return;
  }

  // JS / promise errors in known client files → deep agent directly
  if((obj.type==='js'||obj.type==='promise')&&_jsFileMap[obj.file]){
    const enriched={...entry,filePath:_jsFileMap[obj.file]};
    dbg('[AGENT-2] analyzing JS error...');
    _agentPost('/api/debug-agent-deep', enriched, r=>_logResult(r,2));
    return;
  }

  // Promise errors without a known file — send with whatever stack we have
  if(obj.type==='promise'&&!_jsFileMap[obj.file]){
    dbg('[AGENT-2] unhandled promise rejection — analyzing...');
    _agentPost('/api/debug-agent-deep', entry, r=>_logResult(r,2));
  }
}

(()=>{
  const _orig=window.fetch;
  window.fetch=async function(url,opts){
    let res;
    try{res=await _orig(url,opts);}
    catch(e){dbgStructured({type:'network',message:e.message,url:String(url)});throw e;}
    if(!res.ok&&String(url).startsWith('/api/')&&!String(url).includes('debug-agent')){
      const label=String(url).replace(/^\/api\//,'');
      res.clone().json().then(body=>{
        dbgStructured({type:'api',status:res.status,url:label,message:body.error||body.message||`HTTP ${res.status}`,notion_code:body.notion_code||null});
      }).catch(()=>{
        dbgStructured({type:'api',status:res.status,url:label,message:`HTTP ${res.status}`});
      });
    }
    return res;
  };
})();

async function runMigration(){
  const btn=$('migrate-btn');
  if(!confirm('Run CRM migration? This writes 329 leads to the new database.'))return;
  if(btn){btn.textContent='MIGRATING…';btn.disabled=true;}
  dbg('[MIGRATE] starting…');
  try{
    const r=await fetch('/api/migrate-crm?force=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const d=await r.json();
    if(d.success){
      dbg(`[MIGRATE] done — created:${d.created} failed:${d.failed} total:${d.total}`);
      if(d.errors?.length)d.errors.forEach(e=>dbgWarn(`[MIGRATE] failed: ${e.name} — ${e.error}`));
      if(btn){btn.textContent='DONE ✓';btn.style.borderColor='#0f0';btn.style.color='#0f0';}
    }else{
      dbgWarn('[MIGRATE] error: '+(d.error||JSON.stringify(d)));
      if(btn){btn.textContent='MIGRATE CRM';btn.disabled=false;}
    }
  }catch(e){
    dbgWarn('[MIGRATE] network error: '+e.message);
    if(btn){btn.textContent='MIGRATE CRM';btn.disabled=false;}
  }
}

function openFABSheet(){
  $('fab-sheet')?.classList.add('open');
  $('fab-overlay')?.classList.add('open');
  if (typeof fxConfetti === 'function') fxConfetti($('bn-fab'));
}
function closeFABSheet(){
  $('fab-sheet')?.classList.remove('open');
  $('fab-overlay')?.classList.remove('open');
}
function openDrawer(){
  $('side-drawer')?.classList.add('open');
  $('drawer-overlay')?.classList.add('open');
}
function closeDrawer(){
  $('side-drawer')?.classList.remove('open');
  $('drawer-overlay')?.classList.remove('open');
}

function toggleDebug(){
  const p=$('debug-panel');
  if(p)p.style.display=p.style.display==='block'?'none':'block';
}

function switchTab(t){
  activeTab=t;
  ['deal','crm','bizdev','philosophy','tutorials'].forEach(v=>{
    const el=$('view-'+v);
    if(el)el.classList.toggle('active',v===t);
  });
  // Bottom nav active state (bizdev removed from nav)
  ['deal','crm'].forEach(v=>{
    $('bn-'+v)?.classList.toggle('active',v===t);
  });
  const tb=$('deal-toolbar');
  if(tb)tb.classList.toggle('visible',t==='deal');
  if(t==='deal')switchDealTab(activeDealTab);
  if(t==='crm'){
    if(typeof loadCRM==='function') loadCRM();
    if(typeof crmSwitchTab==='function') crmSwitchTab(typeof crmTab!=='undefined'?crmTab:'cold');
  }
  if(t==='tutorials'){
    document.querySelectorAll('#view-tutorials iframe[data-src]').forEach(f=>{f.src=f.dataset.src;f.removeAttribute('data-src');});
  }

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
  if(t==='drafts'){loadDrafts();intentionalDraft=false;draftActive=false;window._templateMode=false;window._contractTemplateMode=false;}
  if(t==='edit'&&!window._templateMode&&!window._contractTemplateMode){
    const title=document.querySelector('#sub-view-edit .view-hero-title');
    if(title)title.textContent='Edit Deal';
    const sub=document.querySelector('#sub-view-edit .view-hero-sub');
    if(sub)sub.textContent='Fill in retreat details to generate offer & contract';
    const btn=$('save-btn');if(btn){btn.textContent='Save';btn.className='save-btn';}
    const ns=$('notion-status');if(ns)ns.style.display='';
  }
}

function toggleVilla(n){
  $(`${n}-fields`).classList.toggle('disabled',!$(`f-${n}-on`).checked);
}

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
  const _fi=$('f-intro');if(_fi)_fi.value='It was a delight to chat with you and show you around Ubuntu. I hope our meeting let you breathe a little Bali air. Below you will find the offer you requested.';
  const _fb=$('f-body');if(_fb)_fb.value='Kindly open the attached brochure for pictures of the full property.';
  const _finc=$('f-included');if(_finc)_finc.value='2 plant based meals per day\nTea & afternoon snack\nShala of your choice + cleaning\nFull staff support\nDedicated contact person';
  const _fal=$('f-also');if(_fal)_fal.value='Ayurvedic or Balinese menus available on request.\nDay trips and activities around Bali can be arranged.\nMassages, rituals, and photography available.\nAirport pick-up available on request.';
  const _fso=$('f-signoff');if(_fso)_fso.value='Andréa and Tari';
  const _fso2=$('f-signoff2');if(_fso2)_fso2.value='Tari, as representative of Andréa Drottholm';
  draftActive=false;intentionalDraft=true;
  autosaveOn=false;clearInterval(autosaveInterval);autosaveInterval=null;
  const s=$('autosave-status');if(s)s.textContent='';
  if(typeof extraServices!=='undefined'){extraServices=[];renderExtraServices();}
  // Apply master template overrides
  const _tmpl=JSON.parse(localStorage.getItem('masterTemplate')||'null');
  if(_tmpl)TEMPLATE_FIELDS.forEach(id=>{const el=$(id);if(el&&_tmpl[id]!==undefined)el.value=_tmpl[id];});
  switchDealTab('edit');
}

function openTemplateEdit(){
  // Activate deal tab first (this resets _templateMode via switchDealTab('drafts'), which is fine)
  switchTab('deal');
  // Now set template mode and load form
  window._templateMode=true;
  window._linkedLeadId=null;window._linkedLeadName=null;currentPageId=null;
  ['f-name','f-company','f-address','f-phone','f-website','f-title','f-checkin','f-checkout','f-retreatname'].forEach(id=>{const el=$(id);if(el)el.value='';});
  $('f-contractdate').value=todayStr();$('f-validuntil').value=addDays(todayStr(),7);$('f-offervalid').value='';$('notion-status').value='Draft';
  const tmpl=JSON.parse(localStorage.getItem('masterTemplate')||'null');
  const defs={'f-intro':'It was a delight to chat with you and show you around Ubuntu. I hope our meeting let you breathe a little Bali air. Below you will find the offer you requested.','f-body':'Kindly open the attached brochure for pictures of the full property.','f-included':'2 plant based meals per day\nTea & afternoon snack\nShala of your choice + cleaning\nFull staff support\nDedicated contact person','f-also':'Ayurvedic or Balinese menus available on request.\nDay trips and activities around Bali can be arranged.\nMassages, rituals, and photography available.\nAirport pick-up available on request.','f-signoff':'Andréa and Tari','f-signoff2':'Tari, as representative of Andréa Drottholm','f-note':'The package price is fixed for up to {guests} guests. Should your group exceed {guests} people, the room rate remains the same — only meals would be added for each additional guest.','f-roomrate':'60','f-pkgrate':'30.25','f-deposit':''};
  TEMPLATE_FIELDS.forEach(id=>{const el=$(id);if(el)el.value=tmpl?.[id]??defs[id]??'';});
  draftActive=false;intentionalDraft=false;autosaveOn=false;clearInterval(autosaveInterval);autosaveInterval=null;
  const sv=$('autosave-status');if(sv)sv.textContent='';
  if(typeof extraServices!=='undefined'){extraServices=[];renderExtraServices();}
  switchDealTab('edit');
  // Update UI for template mode
  const title=document.querySelector('#sub-view-edit .view-hero-title');if(title)title.textContent='Master Template';
  const sub=document.querySelector('#sub-view-edit .view-hero-sub');if(sub)sub.textContent='Set default text & pricing for all new deals';
  const btn=$('save-btn');if(btn){btn.textContent='Save as Default';btn.className='save-btn';}
  const ns=$('notion-status');if(ns)ns.style.display='none';
}

function showTemplateConfirm(){$('template-confirm')?.classList.add('open');}
function closeTemplateConfirm(){$('template-confirm')?.classList.remove('open');}
function confirmSaveTemplate(){
  const tmpl={};
  TEMPLATE_FIELDS.forEach(id=>{const el=$(id);if(el)tmpl[id]=el.value;});
  localStorage.setItem('masterTemplate',JSON.stringify(tmpl));
  closeTemplateConfirm();
  const btn=$('save-btn');if(btn){btn.textContent='✓ Saved';btn.className='save-btn saved';setTimeout(()=>{btn.textContent='Save as Default';btn.className='save-btn';},3000);}
  dbg('[TEMPLATE] Master offer template saved');
}

const CONTRACT_TMPL_DEFS={
  ub_company:'PT Purusa Yoga Bali (Ubuntu Bali)',ub_director:'Witri Utari',ub_contract_person:'Andréa Drottholm',ub_phone:'+62 812 3862 0082',ub_email:'namaste@ubuntubali.com',ub_sig_name:'Andréa Drottholm',ub_sig_title:'Contract Representative',
  bank_currency:'IDR',bank_holder:'PT PURUSA YOGA BALI',bank_name:'PT Bank Permata, Tbk',bank_account:'4122048077',bank_swift:'BBBAIDJAXXX',bank_address:'Jalan Subak Sari No. 1, Badung, Bali',
  sec_validity:'If not confirmed by the Retreat Organizer by this date, the offer lapses and Ubuntu Bali reserves the right to release the reserved dates.',
  sec_a1:'This Agreement is entered into between Ubuntu Bali and the Retreat Organizer for the purpose of hosting a retreat at Ubuntu Bali for the agreed dates.',
  sec_a2:'This Agreement is intended to clearly define responsibilities, financial commitments, and expectations to ensure a smooth, respectful, and professional collaboration.',
  sec_b_currency:'All prices in this Agreement are stated in {currency}. Payment must be made in IDR, converted at the interbank exchange rate on the date Ubuntu Bali receives payment.',
  sec_b_idr:'The IDR figure above is provided as a reference conversion at the interbank exchange rate on the date of issue. All payments must be made in IDR at the interbank rate on the actual date of each transaction.',
  sec_b_included:'2 plant based meals per day\nTea and afternoon snack\nShala of your choice and cleaning\nFull staff support and dedicated contact person',
  sec_b_pkg:'The package price is fixed for {guests} guests. Should the group exceed {guests} people, the room rate remains the same — only meals would be added for each additional guest.',
  sec_c_fees:'All bank and transfer fees are the responsibility of the Retreat Organizer.',
  sec_d_late:'Failure to meet payment deadlines may result in cancellation of the booking without refund.',
  sec_e_standard:'Standard Bookings: Cancellation refunds are calculated as percentages of the non-refundable deposit only, minus bank transfer fees.',
  sec_e_cancel:'12+ months prior|100%\n9–12 months prior|80%\n6–9 months prior|60%\n3–6 months prior|40%\n1–3 months prior|20%\nLess than 1 month prior|No refund (0%)',
  sec_e_shortnotice:'Short-Notice Bookings: Deposits are non-refundable except in cases of force majeure.',
  sec_e_reschedule:'One reschedule permitted within 12 months, subject to availability and a 10% administrative fee\nRequests must be made at least 3 months prior to retreat start',
  sec_f:'All participants must carry adequate travel and health insurance covering yoga, wellness activities, and medical evacuation\nRetreat Organizer must communicate health restrictions to Ubuntu Bali in writing at least 30 days prior\nUbuntu Bali shall not be held liable for personal injury, loss, or theft except in cases of gross negligence\nUbuntu Bali\'s maximum liability is limited to 50% of the total contract value',
  sec_g:'Quiet hours: 9:30pm – 7:00am\nNo smoking, alcohol, drugs, or intoxicants on the premises\nYoga Shala must be left tidied, fans and lights switched off\nParticipant-caused property damage will be charged to the Retreat Organizer',
  sec_h:'Two plant based meals per day are included for registered overnight guests only. Additional meals must be arranged in advance.',
  sec_i:'Available to all registered retreat participants. All users must shower before entering.',
  sec_j:'Provided across the property in common areas, subject to local service availability.',
  sec_k:'Ubuntu Bali may photograph or film during the retreat for promotional use, subject to retreat leader permission. Participants will not be identified by name without written consent.',
  sec_l:'In the event of circumstances beyond reasonable control, Ubuntu Bali shall provide immediate notice and offer: (a) reschedule within 18 months, (b) 100% credit valid 24 months, or (c) pro-rata refund minus 5% admin fee.',
  sec_m:'Informal Resolution (7 days): Written notice\nManagement Discussion (14 days): In-person or video meeting\nMediation (30 days, optional): Neutral third party\nLegal Action: Only after above steps attempted',
  sec_n:'Ubuntu Bali may cancel with 60 days written notice. Retreat Organizer receives 100% refund and priority rebooking within 18 months. Short-notice cancellation (<60 days): full refund plus 5% credit.',
  sec_o:'Either party may terminate for material breach with 14 days written notice.',
  sec_p:'Governed by the laws of Indonesia. Jurisdiction lies exclusively with the courts of Bali.',
  sec_q:'This Agreement constitutes the entire understanding between the parties. Any amendments must be made in writing and signed by both parties.',
};
const CONTRACT_TMPL_KEYS=Object.keys(CONTRACT_TMPL_DEFS);

const CONTRACT_SEC_ORDER_DEFAULT=['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q'];

function updateSectionLetters(){
  document.querySelectorAll('#ctmpl-sections .ctmpl-section').forEach((el,i)=>{
    const span=el.querySelector('.ctmpl-sec-letter');
    if(span)span.textContent=String.fromCharCode(65+i);
  });
}

function initContractSectionDrag(){
  const container=$('ctmpl-sections');
  if(!container)return;
  let dragSrc=null;
  container.querySelectorAll('.ctmpl-section').forEach(el=>{
    el.addEventListener('dragstart',e=>{
      dragSrc=el;
      e.dataTransfer.effectAllowed='move';
      setTimeout(()=>el.classList.add('dragging'),0);
    });
    el.addEventListener('dragend',()=>{
      el.classList.remove('dragging');
      container.querySelectorAll('.ctmpl-section').forEach(s=>s.classList.remove('drag-over-top','drag-over-bottom'));
      updateSectionLetters();
    });
    el.addEventListener('dragover',e=>{
      e.preventDefault();
      if(el===dragSrc)return;
      container.querySelectorAll('.ctmpl-section').forEach(s=>s.classList.remove('drag-over-top','drag-over-bottom'));
      const mid=el.getBoundingClientRect().top+el.getBoundingClientRect().height/2;
      el.classList.add(e.clientY<mid?'drag-over-top':'drag-over-bottom');
    });
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over-top','drag-over-bottom'));
    el.addEventListener('drop',e=>{
      e.preventDefault();
      el.classList.remove('drag-over-top','drag-over-bottom');
      if(!dragSrc||dragSrc===el)return;
      const mid=el.getBoundingClientRect().top+el.getBoundingClientRect().height/2;
      e.clientY<mid?el.before(dragSrc):el.after(dragSrc);
      updateSectionLetters();
    });
  });
}

function openContractTemplateEdit(){
  const saved=JSON.parse(localStorage.getItem('masterContractTemplate')||'null')||{};
  CONTRACT_TMPL_KEYS.forEach(k=>{const el=$('fct-'+k);if(el)el.value=saved[k]!==undefined?saved[k]:CONTRACT_TMPL_DEFS[k];});
  const order=Array.isArray(saved.section_order)?saved.section_order:CONTRACT_SEC_ORDER_DEFAULT;
  const container=$('ctmpl-sections');
  if(container)order.forEach(k=>{const el=container.querySelector(`[data-skey="${k}"]`);if(el)container.appendChild(el);});
  updateSectionLetters();
  initContractSectionDrag();
  $('contract-tmpl-overlay')?.classList.add('open');
}
function saveContractTemplate(){
  const tmpl={};
  CONTRACT_TMPL_KEYS.forEach(k=>{const el=$('fct-'+k);if(el)tmpl[k]=el.value;});
  tmpl.section_order=[...document.querySelectorAll('#ctmpl-sections .ctmpl-section')].map(el=>el.dataset.skey);
  localStorage.setItem('masterContractTemplate',JSON.stringify(tmpl));
  const btn=$('contract-tmpl-save');
  if(btn){btn.textContent='✓ Saved';setTimeout(()=>{btn.textContent='Save as Default';},2500);}
  dbg('[CONTRACT TEMPLATE] Saved');
}
function closeContractTmplOverlay(e){if(!e||e.target===$('contract-tmpl-overlay'))$('contract-tmpl-overlay')?.classList.remove('open');}

function openMarketing(){$('marketing-overlay')?.classList.add('open');}
function closeMarketing(e){if(!e||e.target===$('marketing-overlay'))$('marketing-overlay')?.classList.remove('open');}

let deferredPrompt=null;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
if(!isStandalone){
  if(isIOS){const b=$('install-btn');if(b)b.style.display='flex';const b2=$('install-btn');if(b2)b2.style.display='flex';}
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
          const b=$('update-btn');if(b){b.style.display='flex';b.classList.add('update-glow');}
          $('avatar-btn')?.classList.add('update-glow');
        }
      });
    });
  });
}
function applyUpdate(){window.location.reload(true);}

$('f-contractdate').value=todayStr();
$('f-validuntil').value=addDays(todayStr(),7);
window.addEventListener('load',()=>{
  switchTab('deal');
  // Pre-load CRM in background so it's ready when the user opens the tab
  setTimeout(()=>{ if(typeof loadCRM==='function') loadCRM(); }, 300);
});

window.offerCurrency     = 'USD';
window.offerCurrencyRate = 1.0;
window._allRates         = {};

(async()=>{
  const dot=$('idr-dot'),info=$('idr-info');
  try{
    const r=await fetch('/api/exchange-rate');
    const d=await r.json();
    $('f-idrrate').value=d.rate;
    window._allRates=d.rates||{IDR:d.rate};
    const now=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    if(d.fallback){dot.className='idr-dot fallback';info.textContent=`⚠ Fallback rate · ${now}`;}
    else{dot.className='idr-dot live';info.textContent=`Live · ${now}`;}
    updateCurrencyTicker();
  }catch{
    if(dot)dot.className='idr-dot error';
    if(info)info.textContent='Could not fetch — using default rate';
  }
})();

function onCurrencyChange(code){
  window.offerCurrency=code;
  window.offerCurrencyRate=code==='USD'?1.0:(window._allRates?.[code]||1.0);
  updateCurrencyTicker();
  if(typeof activeDealTab!=='undefined'){
    if(activeDealTab==='offer'&&typeof renderOffer==='function')renderOffer();
    if(activeDealTab==='contract'&&typeof renderContract==='function')renderContract();
  }
  if(typeof renderExtraServices==='function')renderExtraServices();
}

function updateCurrencyTicker(){
  const el=$('curr-ticker');
  if(!el)return;
  const code=window.offerCurrency||'USD';
  if(code==='USD'){el.textContent='Base currency';return;}
  const rate=window._allRates?.[code];
  el.textContent=rate?`1 USD = ${rate.toFixed(4)} ${code}`:'Rate unavailable';
}

function toggleMoreDetails(btn){
  const details=btn.nextElementSibling;
  const open=details.style.display!=='none';
  details.style.display=open?'none':'block';
  btn.textContent=open?btn.textContent.replace('− ','+ '):btn.textContent.replace('+ ','− ');
}

// Strip beige/coloured backgrounds before printing so they don't bleed into
// empty page space. @media print overrides can be blocked by the SW cache.
window.addEventListener('beforeprint',()=>{
  document.querySelectorAll('.email,.email-wrap,.eb-badge,.e-investment').forEach(el=>{
    el.dataset._bg=el.style.background;
    el.dataset._border=el.style.border;
    el.style.setProperty('background','#fff','important');
    el.style.setProperty('border','none','important');
  });
});
window.addEventListener('afterprint',()=>{
  document.querySelectorAll('.email,.email-wrap,.eb-badge,.e-investment').forEach(el=>{
    el.style.background=el.dataset._bg||'';
    el.style.border=el.dataset._border||'';
  });
});
