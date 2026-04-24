(function(){"use strict";let m=null;async function b(){if(m)return m;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return m=await e.json(),m}async function T(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}m=e}let d=null,u="library";function I(){b().then(e=>{var t;d=JSON.parse(JSON.stringify(e)),H(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function $(){var e;(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function h(e){var t;u=e,x(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}async function S(){const e=document.getElementById("pe-save-btn");if(!e)return;const t=e.textContent;e.textContent="Saving…",e.disabled=!0;try{const n=O();await T(n),d=n,window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:n})),e.textContent="Saved!",setTimeout(()=>{e.textContent=t,e.disabled=!1},2e3)}catch(n){e.textContent="Error — retry",e.disabled=!1,console.error("[PricingEngine] Save failed:",n)}}function A(e){u!=="library"&&h("library");const t=document.getElementById("pe-library-tbody");if(!t)return;const n=document.createElement("tr");n.dataset.id=e.id,n.innerHTML=v(e),t.appendChild(n),n.scrollIntoView({behavior:"smooth",block:"nearest"})}function L(e){var i,a;if(!d)return;u!=="templates"&&h("templates");const t=document.getElementById("pe-templates-list");if(!t)return;const n=document.createElement("div");n.innerHTML=g(e,d.library),t.appendChild(n.firstElementChild),(a=(i=n.firstElementChild)==null?void 0:i.scrollIntoView)==null||a.call(i,{behavior:"smooth",block:"nearest"})}function _(e,t){u!=="library"&&h("library"),document.querySelectorAll("#pe-library-tbody tr").forEach(n=>{n.dataset.id===e&&(n.querySelector(".pe-lib-cost").value=String(t),n.scrollIntoView({behavior:"smooth",block:"nearest"}))})}function D(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=v({id:"",name:"",cost:0},!0),e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus()}function M(e){var t;(t=e.closest("tr"))==null||t.remove()}function B(){const e=document.getElementById("pe-templates-list");if(!e||!d)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=g(t,d.library),e.appendChild(n.firstElementChild)}function q(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove()}function R(e){if(!e.checked)return;const t=e.closest(".pe-template-card");if(!t)return;const n=e.classList.contains("pe-fixed-check"),i=t.querySelector(`${n?".pe-var-check":".pe-fixed-check"}[value="${e.value}"]`);i&&(i.checked=!1)}function H(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel">
      <div class="pe-header">
        <div class="pe-title">Cost Calculation</div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${u==="library"?" active":""}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${u==="templates"?" active":""}" id="pe-tab-templates"
          onclick="window.switchPeTab('templates')">Templates</button>
      </div>
      <div class="pe-tab-content" id="pe-tab-body"></div>
      <div class="pe-chat">
        <div class="pe-chat-header">
          <span>AI Assistant</span>
          <span class="pe-chat-hint">Add items · create templates · explain pricing</span>
        </div>
        <div class="pe-chat-messages" id="pe-chat-messages">
          <div class="pe-chat-msg pe-chat-msg-assistant">Ask me anything — e.g. "Add a rafting guide at 180,000 IDR" or "What's the price per person for 3 people on the trekking tour?"</div>
        </div>
        <div class="pe-chat-input-row">
          <input type="text" id="pe-chat-input" class="pe-input"
            placeholder="Ask or instruct…"
            onkeydown="if(event.key==='Enter')window.sendPeChat()">
          <button class="pill-btn dark" id="pe-chat-send" onclick="window.sendPeChat()">Send</button>
        </div>
      </div>
      <div class="pe-footer">
        <button class="pill-btn dark" id="pe-save-btn" onclick="window.savePricingAdmin()">Save Changes</button>
      </div>
    </div>
  `,x())}function x(){const e=document.getElementById("pe-tab-body");!e||!d||(e.innerHTML=u==="library"?N(d.library):j(d.templates,d.library))}function N(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`<tr data-id="${p(n.id)}">${v(n)}</tr>`).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function v(e,t=!1){return`
    <td><input class="pe-input pe-lib-id"   value="${p(e.id)}"   placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="${p(e.name)}" placeholder="Name"    style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${e.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `}function j(e,t){return`
    <div id="pe-templates-list">${e.map(n=>g(n,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function g(e,t){const n=t.map(i=>{const a=e.fixed_cost_refs.includes(i.id),s=a||e.variable_cost_refs.includes(i.id);return`
      <div class="pe-check-row">
        <input type="checkbox" class="pe-include-check" value="${p(i.id)}" ${s?"checked":""}
          onchange="this.closest('.pe-check-row').querySelector('.pe-fixed-label').classList.toggle('pe-fixed-dim',!this.checked)">
        <span class="pe-check-name">${p(i.name)} <span class="pe-check-id">${p(i.id)}</span></span>
        <label class="pe-fixed-label${s?"":" pe-fixed-dim"}">
          <input type="checkbox" class="pe-fixed-check" value="${p(i.id)}" ${a?"checked":""}>
          fixed ÷pax
        </label>
      </div>
    `}).join("");return`
    <div class="pe-template-card" data-id="${p(e.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${p(e.name)}" placeholder="Template name"
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
        <div class="pe-cost-note">Tick to include. Check "fixed ÷pax" for group costs split by headcount (e.g. transport); leave unticked for per-person costs (e.g. entrance fee, guide).</div>
        <div class="pe-checks">${n}</div>
      </div>
    </div>
  `}function O(){const e=[];document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(n=>{var c,o,r;const i=(c=n.querySelector(".pe-lib-id"))==null?void 0:c.value.trim(),a=(o=n.querySelector(".pe-lib-name"))==null?void 0:o.value.trim(),s=parseFloat((r=n.querySelector(".pe-lib-cost"))==null?void 0:r.value)||0;i&&a&&e.push({id:i,name:a,cost:s})});const t=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(n=>{var r,l;const i=n.dataset.id,a=((r=n.querySelector(".pe-tname"))==null?void 0:r.value.trim())||i,s=parseFloat((l=n.querySelector(".pe-markup"))==null?void 0:l.value)||1,c=[],o=[];n.querySelectorAll(".pe-include-check:checked").forEach(f=>{const E=n.querySelector(`.pe-fixed-check[value="${f.value}"]`);E!=null&&E.checked?c.push(f.value):o.push(f.value)}),t.push({id:i,name:a,markup:s,fixed_cost_refs:c,variable_cost_refs:o})}),{library:e,templates:t}}function p(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function F(e){return new Map(e.map(t=>[t.id,t]))}function U(e,t,n){const i=e.fixed_cost_refs.reduce((o,r)=>{var l;return o+(((l=t.get(r))==null?void 0:l.cost)??0)},0),a=e.variable_cost_refs.reduce((o,r)=>{var l;return o+(((l=t.get(r))==null?void 0:l.cost)??0)},0),s=i/n+a,c=Math.ceil(s*e.markup);return{fixedTotal:i,variableTotal:a,costPerPerson:s,sellingPrice:c}}function J(e){P(e),window.addEventListener("pricingDataUpdated",t=>{P(t.detail)})}function P(e){var i;const t=document.getElementById("extras-picker");if(!t||((i=t.querySelector('optgroup[label="Experiences"]'))==null||i.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(a=>{const s=document.createElement("option");s.value=`pe_${a.id}|${a.name}`,s.textContent=`🧭 ${a.name}`,n.appendChild(s)}),t.appendChild(n)}async function V(e,t){var i,a,s;t=Math.max(1,Math.floor(t));const n=(i=window.extraServices)==null?void 0:i.find(c=>c.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const c=await b(),o=c.templates.find(f=>f.id===n.templateId);if(!o)return;const r=z(),{sellingPrice:l}=U(o,F(c.library),t);n.pax=t,n.spppIdr=l,n.unitUsd=r>0?l*t/r:0,(a=window.renderExtraServices)==null||a.call(window),(s=window.markDraftActive)==null||s.call(window)}catch(c){console.error("[PricingEngine] recalculate failed:",c)}}function z(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}let w=[];const y=new Map;async function W(){const e=document.getElementById("pe-chat-input"),t=document.getElementById("pe-chat-send"),n=document.getElementById("pe-chat-messages");if(!e||!n)return;const i=e.value.trim();if(i){k(n,"user",i),e.value="",t&&(t.disabled=!0,t.textContent="…"),n.scrollTop=n.scrollHeight;try{const s=await(await fetch("/api/pricing-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:i,pricingData:window._pricingData,history:w})})).json();if(w.push({role:"user",content:i}),s.reply&&(w.push({role:"assistant",content:s.reply}),k(n,"assistant",s.reply)),s.toolCall){const c="pe-action-"+Date.now();y.set(c,s.toolCall),Q(n,c,s.toolCall)}}catch{k(n,"assistant","⚠ Request failed. Try again.")}t&&(t.disabled=!1,t.textContent="Send"),n.scrollTop=n.scrollHeight}}function G(e){var a;const t=y.get(e);if(!t)return;y.delete(e);const{name:n,input:i}=t;n==="add_library_item"?A(i):n==="create_template"?L(i):n==="update_cost"&&_(i.id,i.cost),(a=document.getElementById(e))==null||a.remove(),Y()}function K(e){var t;y.delete(e),(t=document.getElementById(e))==null||t.remove()}function k(e,t,n){const i=document.createElement("div");i.className=`pe-chat-msg pe-chat-msg-${t}`,i.textContent=n,e.appendChild(i)}function Q(e,t,n){const i=document.createElement("div");i.className="pe-action-card",i.id=t,i.innerHTML=`
    <div class="pe-action-label">${X(n)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${t}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${t}')">Dismiss</button>
    </div>
  `,e.appendChild(i)}function X({name:e,input:t}){const n=i=>Number(i).toLocaleString("id-ID");return e==="add_library_item"?`Add "${t.name}" — IDR ${n(t.cost)}`:e==="create_template"?`Create template "${t.name}" (markup ×${t.markup})`:e==="update_cost"?`Update ${t.id} → IDR ${n(t.cost)}`:e}function Y(){const e=document.getElementById("pe-save-btn");e&&(e.classList.add("pe-save-pulse"),setTimeout(()=>e.classList.remove("pe-save-pulse"),2e3))}window.openPricingAdmin=I,window.closePricingAdmin=$,window.switchPeTab=h,window.savePricingAdmin=S,window.addPeLibraryRow=D,window.removePeLibraryRow=M,window.addPeTemplate=B,window.removePeTemplate=q,window.enforceMutualExclusion=R,window.recalculatePeExtra=V,window.sendPeChat=W,window.applyPeAction=G,window.dismissPeAction=K;async function C(){try{const e=await b();window._pricingData=e,J(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",C):C()})();
