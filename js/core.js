const $=id=>document.getElementById(id);
const fmtN=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtD=s=>{if(!s)return'';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});};
const fmtDS=s=>{if(!s)return'___________';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});};
const todayStr=()=>new Date().toISOString().split('T')[0];
const addDays=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];};
const addMonths=(date,n)=>{if(!date)return'';const d=new Date(date+'T00:00:00');d.setMonth(d.getMonth()+n);return d.toISOString().split('T')[0];};

let activeTab='drafts', currentPageId=null, autosaveOn=false, autosaveInterval=null, draftActive=false, intentionalDraft=false;
let crmData={leads:[],converted:[]}, crmTab='leads', crmLoaded=false;

function toggleDebug(){
  const p=document.getElementById('debug-panel');
  if(p)p.style.display=p.style.display==='block'?'none':'block';
  document.getElementById('nav-dropdown').style.display='none';
}

function toggleNavMenu(){
  const d=document.getElementById('nav-dropdown');
  d.style.display=d.style.display==='block'?'none':'block';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#main-nav') && !e.target.closest('#nav-dropdown')){
    const d=document.getElementById('nav-dropdown');
    if(d)d.style.display='none';
  }
});

function switchTab(t){
  activeTab=t;
  ['edit','offer','contract','drafts','crm','philosophy'].forEach(v=>{const el=$('view-'+v);if(el)el.classList.toggle('active',v===t)});
  document.querySelectorAll('.nav-tab[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  if(t==='offer') renderOffer();
  if(t==='contract') renderContract();
  if(t==='drafts'){loadDrafts();intentionalDraft=false;draftActive=false;}
  if(t==='crm'){loadCRM();crmSwitchTab(crmTab);}
  const nd=document.getElementById('nav-dropdown');if(nd)nd.style.display='none';
}

function toggleVilla(n){$(`${n}-fields`).classList.toggle('disabled',!$(`f-${n}-on`).checked);}

function toggleAutosave(){
  // kept for compatibility but autosave is managed automatically
}
