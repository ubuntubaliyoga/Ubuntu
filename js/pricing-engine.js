(function(){"use strict";let u=null;async function f(){if(u)return u;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return u=await e.json(),u}async function E(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}u=e}let r=null,m="library";function P(e){r=JSON.parse(JSON.stringify(e))}function S(){f().then(e=>{r=JSON.parse(JSON.stringify(e)),I();const t=document.getElementById("pricing-overlay");t&&t.classList.add("open")})}function T(){const e=document.getElementById("pricing-overlay");e&&e.classList.remove("open")}function $(e){var t;m=e,b(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}async function C(){const e=document.getElementById("pe-save-btn");if(!e)return;const t=e.textContent;e.textContent="Saving…",e.disabled=!0;try{const n=B();await E(n),r=n;const a=new CustomEvent("pricingDataUpdated",{detail:n});window.dispatchEvent(a),e.textContent="Saved!",setTimeout(()=>{e.textContent=t,e.disabled=!1},2e3)}catch(n){e.textContent="Error — retry",e.disabled=!1,console.error("[PricingEngine] Save failed:",n)}}function I(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel">
      <div class="pe-header">
        <div class="pe-title">Cost Calculation</div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${m==="library"?" active":""}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${m==="templates"?" active":""}" id="pe-tab-templates"
          onclick="window.switchPeTab('templates')">Templates</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
      <div class="pe-footer">
        <button class="pill-btn dark" id="pe-save-btn" onclick="window.savePricingAdmin()">Save Changes</button>
      </div>
    </div>
  `,b())}function b(){const e=document.getElementById("pe-tab-body");!e||!r||(e.innerHTML=m==="library"?D(r.library):L(r.templates,r.library))}function D(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`
    <tr data-id="${s(n.id)}">
      <td><input class="pe-input pe-lib-id" value="${s(n.id)}" placeholder="ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
      <td><input class="pe-input pe-lib-name" value="${s(n.name)}" placeholder="Name" style="width:100%;"></td>
      <td><input class="pe-input pe-lib-cost" type="number" value="${n.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
      <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
    </tr>
  `).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function L(e,t){return`
    <div id="pe-templates-list">${e.map(a=>w(a,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function w(e,t){const n=t.map(i=>`
    <label class="pe-check-row">
      <input type="checkbox" class="pe-fixed-check" value="${s(i.id)}"
        ${e.fixed_cost_refs.includes(i.id)?"checked":""}
        onchange="window.enforceMutualExclusion(this)">
      ${s(i.name)} <span class="pe-check-id">${s(i.id)}</span>
    </label>
  `).join(""),a=t.map(i=>`
    <label class="pe-check-row">
      <input type="checkbox" class="pe-var-check" value="${s(i.id)}"
        ${e.variable_cost_refs.includes(i.id)?"checked":""}
        onchange="window.enforceMutualExclusion(this)">
      ${s(i.name)} <span class="pe-check-id">${s(i.id)}</span>
    </label>
  `).join("");return`
    <div class="pe-template-card" data-id="${s(e.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${s(e.name)}" placeholder="Template name" style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${e.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete template">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Fixed Costs <span class="pe-costs-hint">(shared ÷ pax)</span></div>
        <div class="pe-checks">${n}</div>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Variable Costs <span class="pe-costs-hint">(per person)</span></div>
        <div class="pe-checks">${a}</div>
      </div>
    </div>
  `}function _(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=`
    <td><input class="pe-input pe-lib-id" value="" placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="" placeholder="Name" style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="0" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)">✕</button></td>
  `,e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus()}function A(e){var t;(t=e.closest("tr"))==null||t.remove()}function M(){const e=document.getElementById("pe-templates-list");if(!e||!r)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=w(t,r.library),e.appendChild(n.firstElementChild)}function q(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove()}function R(e){if(!e.checked)return;const t=e.closest(".pe-template-card");if(!t)return;const n=e.value,i=e.classList.contains("pe-fixed-check")?".pe-var-check":".pe-fixed-check",c=t.querySelector(`${i}[value="${n}"]`);c&&(c.checked=!1)}function B(){const e=[];document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(n=>{var l,o,d;const a=(l=n.querySelector(".pe-lib-id"))==null?void 0:l.value.trim(),i=(o=n.querySelector(".pe-lib-name"))==null?void 0:o.value.trim(),c=parseFloat((d=n.querySelector(".pe-lib-cost"))==null?void 0:d.value)||0;a&&i&&e.push({id:a,name:i,cost:c})});const t=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(n=>{var d,p;const a=n.dataset.id,i=((d=n.querySelector(".pe-tname"))==null?void 0:d.value.trim())||a,c=parseFloat((p=n.querySelector(".pe-markup"))==null?void 0:p.value)||1,l=Array.from(n.querySelectorAll(".pe-fixed-check:checked")).map(v=>v.value),o=Array.from(n.querySelectorAll(".pe-var-check:checked")).map(v=>v.value);t.push({id:a,name:i,markup:c,fixed_cost_refs:l,variable_cost_refs:o})}),{library:e,templates:t}}function s(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function y(e){return new Map(e.map(t=>[t.id,t]))}function h(e,t,n){const a=e.fixed_cost_refs.reduce((o,d)=>{var p;return o+(((p=t.get(d))==null?void 0:p.cost)??0)},0),i=e.variable_cost_refs.reduce((o,d)=>{var p;return o+(((p=t.get(d))==null?void 0:p.cost)??0)},0),c=a/n+i,l=Math.ceil(c*e.markup);return{fixedTotal:a,variableTotal:i,costPerPerson:c,sellingPrice:l}}function F(e){g(e),window.addEventListener("pricingDataUpdated",t=>{g(t.detail)})}function g(e){var a;const t=document.getElementById("extras-picker");if(!t||((a=t.querySelector('optgroup[label="Experiences"]'))==null||a.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(i=>{const c=document.createElement("option");c.value=`pe_${i.id}|${i.name}`,c.textContent=`🧭 ${i.name}`,n.appendChild(c)}),t.appendChild(n)}async function N(e,t){t=Math.max(1,Math.floor(t));const n=window.extraServices,a=n==null?void 0:n.find(i=>i.id===e);if(!(!(a!=null&&a.pricingEngine)||!a.templateId))try{const i=await f(),c=i.templates.find(o=>o.id===a.templateId);if(!c)return;const l=h(c,y(i.library),t);a.pax=t,a.spppIdr=l.sellingPrice,a.unitUsd=x()>0?l.sellingPrice*t/x():0,typeof window.renderExtraServices=="function"&&window.renderExtraServices(),typeof window.markDraftActive=="function"&&window.markDraftActive()}catch(i){console.error("[PricingEngine] recalculate failed:",i)}}function O(e,t){const n=window._pricingData;if(!n)return 0;const a=n.templates.find(i=>i.id===e);return a?h(a,y(n.library),t).sellingPrice:0}function x(){const e=document.getElementById("f-idrrate");return parseFloat((e==null?void 0:e.value)??"")||17085}window.openPricingAdmin=S,window.closePricingAdmin=T,window.switchPeTab=$,window.savePricingAdmin=C,window.addPeLibraryRow=_,window.removePeLibraryRow=A,window.addPeTemplate=M,window.removePeTemplate=q,window.enforceMutualExclusion=R,window.recalculatePeExtra=N,window.getSpppSync=O;async function k(){try{const e=await f();window._pricingData=e,P(e),F(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",k):k()})();
