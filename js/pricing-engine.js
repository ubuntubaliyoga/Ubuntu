(function(){"use strict";let y=null;async function g(){if(y)return y;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return y=await e.json(),y}async function _(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}y=e}let r=null,d="library",f=null;function D(){g().then(e=>{var t;r=JSON.parse(JSON.stringify(e)),U(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function M(){var e;f&&(clearTimeout(f),w(!0)),(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function b(e){var t;r&&(d==="library"?r={...r,library:$().sort((n,a)=>n.name.localeCompare(a.name))}:r={...r,templates:k().sort((n,a)=>n.name.localeCompare(a.name))}),d=e,I(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}function p(){const e=document.getElementById("pe-autosave-status");e&&(e.textContent="● Unsaved changes"),f&&clearTimeout(f),f=setTimeout(()=>w(!0),2e3)}async function w(e=!1){const t=document.getElementById("pe-save-btn"),n=document.getElementById("pe-autosave-status");!e&&t&&(t.textContent="Saving…",t.disabled=!0),n&&(n.textContent="○ Saving…");try{r&&(d==="library"?r={...r,library:$().sort((o,i)=>o.name.localeCompare(i.name))}:r={...r,templates:k().sort((o,i)=>o.name.localeCompare(i.name))});const a=r;await _(a),window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:a})),!e&&t&&(t.textContent="Saved!",setTimeout(()=>{t&&(t.textContent="Save Changes",t.disabled=!1)},2e3)),n&&(n.textContent="✓ Saved"),f=null}catch(a){!e&&t&&(t.textContent="Error — retry",t.disabled=!1),n&&(n.textContent="⚠ Save failed"),console.error("[PricingEngine] Save failed:",a)}}function B(e){d!=="library"&&b("library");const t=document.getElementById("pe-library-tbody");if(!t)return;const n=document.createElement("tr");n.dataset.id=e.id,n.innerHTML=E(e),t.appendChild(n),n.scrollIntoView({behavior:"smooth",block:"nearest"}),p()}function q(e){var a,o;if(!r)return;d!=="templates"&&b("templates");const t=document.getElementById("pe-templates-list");if(!t)return;const n=document.createElement("div");n.innerHTML=C(e,r.library),t.appendChild(n.firstElementChild),(o=(a=n.firstElementChild)==null?void 0:a.scrollIntoView)==null||o.call(a,{behavior:"smooth",block:"nearest"}),p()}function R(e,t){d!=="library"&&b("library"),document.querySelectorAll("#pe-library-tbody tr").forEach(n=>{n.dataset.id===e&&(n.querySelector(".pe-lib-cost").value=String(t),n.scrollIntoView({behavior:"smooth",block:"nearest"}))}),p()}function H(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id=z(),t.innerHTML=E({name:"",cost:0}),e.appendChild(t),(n=t.querySelector(".pe-lib-name"))==null||n.focus(),p()}function N(e){var t;(t=e.closest("tr"))==null||t.remove(),p()}function j(){const e=document.getElementById("pe-templates-list");if(!e||!r)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=C(t,r.library),e.appendChild(n.firstElementChild),p()}function O(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove(),p()}function F(e){var i;const t=e.value;if(!t||!r)return;e.value="";const n=e.closest(".pe-template-card");if(!n||n.querySelector(`.pe-cost-chip[data-item-id="${t}"]`))return;const a=r.library.find(s=>s.id===t);if(!a)return;const o=document.createElement("div");o.className="pe-cost-chip",o.dataset.itemId=t,o.innerHTML=S(a.id,a.name,!1),(i=n.querySelector(".pe-cost-chips"))==null||i.appendChild(o),p()}function U(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel" oninput="window.triggerPeAutosave()" onchange="window.triggerPeAutosave()">
      <div class="pe-header">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="pe-title">Edit Extra Services</div>
          <div id="pe-autosave-status" style="font-size:10px; color:var(--text-dim); font-family:monospace;">✓ Saved</div>
        </div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${d==="library"?" active":""}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${d==="templates"?" active":""}" id="pe-tab-templates"
          onclick="window.switchPeTab('templates')">Templates</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
    </div>
  `,I())}function I(){const e=document.getElementById("pe-tab-body");!e||!r||(e.innerHTML=d==="library"?J(r.library):V(r.templates,r.library))}function J(e){return`
    <div class="pe-section-hint">Costs in IDR.</div>
    <table class="pe-table">
      <thead><tr><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${[...e].sort((a,o)=>a.name.localeCompare(o.name)).map(a=>`<tr data-id="${u(a.id)}">${E(a)}</tr>`).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function E(e){return`
    <td><input class="pe-input pe-lib-name" value="${u(e.name)}" placeholder="Name" style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${e.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `}function V(e,t){return`
    <div id="pe-templates-list">${[...e].sort((a,o)=>a.name.localeCompare(o.name)).map(a=>C(a,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function S(e,t,n){return`
    <span class="pe-chip-name">${u(t)}</span>
    <label class="pe-fixed-label">
      <input type="checkbox" class="pe-fixed-check" value="${u(e)}" ${n?"checked":""}>
      fixed ÷pax
    </label>
    <button class="pe-del-btn" onclick="this.closest('.pe-cost-chip').remove()" title="Remove">✕</button>
  `}function C(e,t){const a=[...e.fixed_cost_refs,...e.variable_cost_refs].map(i=>{const s=t.find(c=>c.id===i);return s?`<div class="pe-cost-chip" data-item-id="${u(i)}">${S(i,s.name,e.fixed_cost_refs.includes(i))}</div>`:""}).join(""),o=t.map(i=>`<option value="${u(i.id)}">${u(i.name)}</option>`).join("");return`
    <div class="pe-template-card" data-id="${u(e.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${u(e.name)}" placeholder="Template name"
            style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${e.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete template">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Costs</div>
        <select class="pe-input pe-add-cost" onchange="window.peAddCostItem(this)">
          <option value="">＋ Add cost item…</option>
          ${o}
        </select>
        <div class="pe-cost-chips">${a}</div>
      </div>
    </div>
  `}function $(){const e=[];return document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(t=>{var i,s;const n=t.dataset.id,a=(i=t.querySelector(".pe-lib-name"))==null?void 0:i.value.trim(),o=parseFloat((s=t.querySelector(".pe-lib-cost"))==null?void 0:s.value)||0;a&&e.push({id:n,name:a,cost:o})}),e}function k(){const e=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(t=>{var c,m;const n=t.dataset.id,a=((c=t.querySelector(".pe-tname"))==null?void 0:c.value.trim())||n,o=parseFloat((m=t.querySelector(".pe-markup"))==null?void 0:m.value)||1,i=[],s=[];t.querySelectorAll(".pe-cost-chip[data-item-id]").forEach(l=>{const h=l.dataset.itemId,T=l.querySelector(".pe-fixed-check");T!=null&&T.checked?i.push(h):s.push(h)}),e.push({id:n,name:a,markup:o,fixed_cost_refs:i,variable_cost_refs:s})}),e}function u(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function z(){return"item_"+Math.random().toString(36).slice(2,10)}function G(e){return new Map(e.map(t=>[t.id,t]))}function K(e,t,n){const a=e.fixed_cost_refs.reduce((c,m)=>{var l;return c+(((l=t.get(m))==null?void 0:l.cost)??0)},0),o=e.variable_cost_refs.reduce((c,m)=>{var l;return c+(((l=t.get(m))==null?void 0:l.cost)??0)},0),i=a/n+o,s=Math.ceil(i*e.markup);return{fixedTotal:a,variableTotal:o,costPerPerson:i,sellingPrice:s}}function Q(e){L(e),window.addEventListener("pricingDataUpdated",t=>{L(t.detail)})}function L(e){var a;const t=document.getElementById("extras-picker");if(!t||((a=t.querySelector('optgroup[label="Experiences"]'))==null||a.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(o=>{const i=document.createElement("option");i.value=`pe_${o.id}|${o.name}`,i.textContent=`🧭 ${o.name}`,n.appendChild(i)}),t.appendChild(n)}async function W(e,t){var a,o,i;t=Math.max(1,Math.floor(t));const n=(a=window.extraServices)==null?void 0:a.find(s=>s.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const s=await g(),c=s.templates.find(h=>h.id===n.templateId);if(!c)return;const m=X(),{sellingPrice:l}=K(c,G(s.library),t);n.pax=t,n.spppIdr=l,n.unitUsd=m>0?l*t/m:0,(o=window.renderExtraServices)==null||o.call(window),(i=window.markDraftActive)==null||i.call(window)}catch(s){console.error("[PricingEngine] recalculate failed:",s)}}function X(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}let P=[];const v=new Map;async function Y(){const e=document.getElementById("pe-chat-input"),t=document.getElementById("pe-chat-send"),n=document.getElementById("pe-chat-messages");if(!e||!n)return;const a=e.value.trim();if(a){x(n,"user",a),e.value="",t&&(t.disabled=!0,t.textContent="…"),n.scrollTop=n.scrollHeight;try{const i=await(await fetch("/api/pricing-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:a,pricingData:window._pricingData,history:P})})).json();if(P.push({role:"user",content:a}),i.reply&&(P.push({role:"assistant",content:i.reply}),x(n,"assistant",i.reply)),i.toolCall){const s="pe-action-"+Date.now();v.set(s,i.toolCall),te(n,s,i.toolCall)}}catch{x(n,"assistant","⚠ Request failed. Try again.")}t&&(t.disabled=!1,t.textContent="Send"),n.scrollTop=n.scrollHeight}}function Z(e){var o;const t=v.get(e);if(!t)return;v.delete(e);const{name:n,input:a}=t;n==="add_library_item"?B(a):n==="create_template"?q(a):n==="update_cost"&&R(a.id,a.cost),(o=document.getElementById(e))==null||o.remove(),ae()}function ee(e){var t;v.delete(e),(t=document.getElementById(e))==null||t.remove()}function x(e,t,n){const a=document.createElement("div");a.className=`pe-chat-msg pe-chat-msg-${t}`,a.textContent=n,e.appendChild(a)}function te(e,t,n){const a=document.createElement("div");a.className="pe-action-card",a.id=t,a.innerHTML=`
    <div class="pe-action-label">${ne(n)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${t}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${t}')">Dismiss</button>
    </div>
  `,e.appendChild(a)}function ne({name:e,input:t}){const n=a=>Number(a).toLocaleString("id-ID");return e==="add_library_item"?`Add "${t.name}" — IDR ${n(t.cost)}`:e==="create_template"?`Create template "${t.name}" (markup ×${t.markup})`:e==="update_cost"?`Update ${t.id} → IDR ${n(t.cost)}`:e}function ae(){const e=document.getElementById("pe-save-btn");e&&(e.classList.add("pe-save-pulse"),setTimeout(()=>e.classList.remove("pe-save-pulse"),2e3))}window.openPricingAdmin=D,window.closePricingAdmin=M,window.switchPeTab=b,window.savePricingAdmin=w,window.triggerPeAutosave=p,window.addPeLibraryRow=H,window.removePeLibraryRow=N,window.addPeTemplate=j,window.removePeTemplate=O,window.peAddCostItem=F,window.recalculatePeExtra=W,window.sendPeChat=Y,window.applyPeAction=Z,window.dismissPeAction=ee;async function A(){try{const e=await g();window._pricingData=e,Q(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",A):A()})();
