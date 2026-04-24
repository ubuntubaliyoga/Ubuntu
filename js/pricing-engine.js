(function(){"use strict";let u=null;async function b(){if(u)return u;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return u=await e.json(),u}async function g(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}u=e}let d=null,v="library";function x(){b().then(e=>{var t;d=JSON.parse(JSON.stringify(e)),T(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function E(){var e;(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function P(e){var t;v=e,f(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}async function k(){const e=document.getElementById("pe-save-btn");if(!e)return;const t=e.textContent;e.textContent="Saving…",e.disabled=!0;try{const n=A();await g(n),d=n,window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:n})),e.textContent="Saved!",setTimeout(()=>{e.textContent=t,e.disabled=!1},2e3)}catch(n){e.textContent="Error — retry",e.disabled=!1,console.error("[PricingEngine] Save failed:",n)}}function T(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel">
      <div class="pe-header">
        <div class="pe-title">Cost Calculation</div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${v==="library"?" active":""}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${v==="templates"?" active":""}" id="pe-tab-templates"
          onclick="window.switchPeTab('templates')">Templates</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
      <div class="pe-footer">
        <button class="pill-btn dark" id="pe-save-btn" onclick="window.savePricingAdmin()">Save Changes</button>
      </div>
    </div>
  `,f())}function f(){const e=document.getElementById("pe-tab-body");!e||!d||(e.innerHTML=v==="library"?S(d.library):$(d.templates,d.library))}function S(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`
    <tr data-id="${p(n.id)}">
      <td><input class="pe-input pe-lib-id" value="${p(n.id)}" placeholder="ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
      <td><input class="pe-input pe-lib-name" value="${p(n.name)}" placeholder="Name" style="width:100%;"></td>
      <td><input class="pe-input pe-lib-cost" type="number" value="${n.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
      <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
    </tr>
  `).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function $(e,t){return`
    <div id="pe-templates-list">${e.map(n=>y(n,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function y(e,t){const n=(a,c)=>t.map(i=>`
    <label class="pe-check-row">
      <input type="checkbox" class="${a}" value="${p(i.id)}"
        ${c.includes(i.id)?"checked":""}
        onchange="window.enforceMutualExclusion(this)">
      ${p(i.name)} <span class="pe-check-id">${p(i.id)}</span>
    </label>
  `).join("");return`
    <div class="pe-template-card" data-id="${p(e.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${p(e.name)}" placeholder="Template name" style="width:100%;font-size:15px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span class="pe-section-hint" style="margin:0;">Markup</span>
            <input class="pe-input pe-markup" type="number" value="${e.markup}" min="1" step="0.01" style="width:80px;">
          </div>
        </div>
        <button class="pe-del-btn" onclick="window.removePeTemplate(this)" title="Delete template">✕</button>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Fixed Costs <span class="pe-costs-hint">(shared ÷ pax)</span></div>
        <div class="pe-checks">${n("pe-fixed-check",e.fixed_cost_refs)}</div>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Variable Costs <span class="pe-costs-hint">(per person)</span></div>
        <div class="pe-checks">${n("pe-var-check",e.variable_cost_refs)}</div>
      </div>
    </div>
  `}function C(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=`
    <td><input class="pe-input pe-lib-id" value="" placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="" placeholder="Name" style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="0" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)">✕</button></td>
  `,e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus()}function I(e){var t;(t=e.closest("tr"))==null||t.remove()}function L(){const e=document.getElementById("pe-templates-list");if(!e||!d)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=y(t,d.library),e.appendChild(n.firstElementChild)}function _(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove()}function D(e){if(!e.checked)return;const t=e.closest(".pe-template-card");if(!t)return;const n=e.classList.contains("pe-fixed-check"),a=t.querySelector(`${n?".pe-var-check":".pe-fixed-check"}[value="${e.value}"]`);a&&(a.checked=!1)}function A(){const e=[];document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(n=>{var r,s,o;const a=(r=n.querySelector(".pe-lib-id"))==null?void 0:r.value.trim(),c=(s=n.querySelector(".pe-lib-name"))==null?void 0:s.value.trim(),i=parseFloat((o=n.querySelector(".pe-lib-cost"))==null?void 0:o.value)||0;a&&c&&e.push({id:a,name:c,cost:i})});const t=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(n=>{var o,l;const a=n.dataset.id,c=((o=n.querySelector(".pe-tname"))==null?void 0:o.value.trim())||a,i=parseFloat((l=n.querySelector(".pe-markup"))==null?void 0:l.value)||1,r=Array.from(n.querySelectorAll(".pe-fixed-check:checked")).map(m=>m.value),s=Array.from(n.querySelectorAll(".pe-var-check:checked")).map(m=>m.value);t.push({id:a,name:c,markup:i,fixed_cost_refs:r,variable_cost_refs:s})}),{library:e,templates:t}}function p(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function M(e){return new Map(e.map(t=>[t.id,t]))}function q(e,t,n){const a=e.fixed_cost_refs.reduce((s,o)=>{var l;return s+(((l=t.get(o))==null?void 0:l.cost)??0)},0),c=e.variable_cost_refs.reduce((s,o)=>{var l;return s+(((l=t.get(o))==null?void 0:l.cost)??0)},0),i=a/n+c,r=Math.ceil(i*e.markup);return{fixedTotal:a,variableTotal:c,costPerPerson:i,sellingPrice:r}}function R(e){w(e),window.addEventListener("pricingDataUpdated",t=>{w(t.detail)})}function w(e){var a;const t=document.getElementById("extras-picker");if(!t||((a=t.querySelector('optgroup[label="Experiences"]'))==null||a.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(c=>{const i=document.createElement("option");i.value=`pe_${c.id}|${c.name}`,i.textContent=`🧭 ${c.name}`,n.appendChild(i)}),t.appendChild(n)}async function B(e,t){var a,c,i;t=Math.max(1,Math.floor(t));const n=(a=window.extraServices)==null?void 0:a.find(r=>r.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const r=await b(),s=r.templates.find(m=>m.id===n.templateId);if(!s)return;const o=F(),{sellingPrice:l}=q(s,M(r.library),t);n.pax=t,n.spppIdr=l,n.unitUsd=o>0?l*t/o:0,(c=window.renderExtraServices)==null||c.call(window),(i=window.markDraftActive)==null||i.call(window)}catch(r){console.error("[PricingEngine] recalculate failed:",r)}}function F(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}window.openPricingAdmin=x,window.closePricingAdmin=E,window.switchPeTab=P,window.savePricingAdmin=k,window.addPeLibraryRow=C,window.removePeLibraryRow=I,window.addPeTemplate=L,window.removePeTemplate=_,window.enforceMutualExclusion=D,window.recalculatePeExtra=B;async function h(){try{const e=await b();window._pricingData=e,R(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",h):h()})();
