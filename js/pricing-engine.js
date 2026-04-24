(function(){"use strict";let m=null;async function h(){if(m)return m;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return m=await e.json(),m}async function C(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}m=e}let d=null,u="library";function I(){h().then(e=>{var t;d=JSON.parse(JSON.stringify(e)),R(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function T(){var e;(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function v(e){var t;u=e,k(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}async function $(){const e=document.getElementById("pe-save-btn");if(!e)return;const t=e.textContent;e.textContent="Saving…",e.disabled=!0;try{const n=O();await C(n),d=n,window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:n})),e.textContent="Saved!",setTimeout(()=>{e.textContent=t,e.disabled=!1},2e3)}catch(n){e.textContent="Error — retry",e.disabled=!1,console.error("[PricingEngine] Save failed:",n)}}function A(e){u!=="library"&&v("library");const t=document.getElementById("pe-library-tbody");if(!t)return;const n=document.createElement("tr");n.dataset.id=e.id,n.innerHTML=b(e),t.appendChild(n),n.scrollIntoView({behavior:"smooth",block:"nearest"})}function S(e){var a,s;if(!d)return;u!=="templates"&&v("templates");const t=document.getElementById("pe-templates-list");if(!t)return;const n=document.createElement("div");n.innerHTML=g(e,d.library),t.appendChild(n.firstElementChild),(s=(a=n.firstElementChild)==null?void 0:a.scrollIntoView)==null||s.call(a,{behavior:"smooth",block:"nearest"})}function L(e,t){u!=="library"&&v("library"),document.querySelectorAll("#pe-library-tbody tr").forEach(n=>{n.dataset.id===e&&(n.querySelector(".pe-lib-cost").value=String(t),n.scrollIntoView({behavior:"smooth",block:"nearest"}))})}function _(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=b({id:"",name:"",cost:0},!0),e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus()}function D(e){var t;(t=e.closest("tr"))==null||t.remove()}function M(){const e=document.getElementById("pe-templates-list");if(!e||!d)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=g(t,d.library),e.appendChild(n.firstElementChild)}function B(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove()}function q(e){if(!e.checked)return;const t=e.closest(".pe-template-card");if(!t)return;const n=e.classList.contains("pe-fixed-check"),a=t.querySelector(`${n?".pe-var-check":".pe-fixed-check"}[value="${e.value}"]`);a&&(a.checked=!1)}function R(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
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
  `,k())}function k(){const e=document.getElementById("pe-tab-body");!e||!d||(e.innerHTML=u==="library"?H(d.library):N(d.templates,d.library))}function H(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`<tr data-id="${p(n.id)}">${b(n)}</tr>`).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function b(e,t=!1){return`
    <td><input class="pe-input pe-lib-id"   value="${p(e.id)}"   placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="${p(e.name)}" placeholder="Name"    style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${e.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `}function N(e,t){return`
    <div id="pe-templates-list">${e.map(n=>g(n,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function g(e,t){const n=(a,s)=>t.map(i=>`
    <label class="pe-check-row">
      <input type="checkbox" class="${a}" value="${p(i.id)}"
        ${s.includes(i.id)?"checked":""}
        onchange="window.enforceMutualExclusion(this)">
      ${p(i.name)} <span class="pe-check-id">${p(i.id)}</span>
    </label>
  `).join("");return`
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
        <div class="pe-costs-label">Fixed Costs <span class="pe-costs-hint">(shared ÷ pax)</span></div>
        <div class="pe-cost-note">One cost for the whole group, split equally — e.g. transport is IDR 300,000 for one car regardless of group size, so 5 people each pay IDR 60,000.</div>
        <div class="pe-checks">${n("pe-fixed-check",e.fixed_cost_refs)}</div>
      </div>
      <div class="pe-costs-section">
        <div class="pe-costs-label">Variable Costs <span class="pe-costs-hint">(per person)</span></div>
        <div class="pe-cost-note">Each person pays this — e.g. every participant needs their own entrance ticket, lunch, and offering.</div>
        <div class="pe-checks">${n("pe-var-check",e.variable_cost_refs)}</div>
      </div>
    </div>
  `}function O(){const e=[];document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(n=>{var o,r,c;const a=(o=n.querySelector(".pe-lib-id"))==null?void 0:o.value.trim(),s=(r=n.querySelector(".pe-lib-name"))==null?void 0:r.value.trim(),i=parseFloat((c=n.querySelector(".pe-lib-cost"))==null?void 0:c.value)||0;a&&s&&e.push({id:a,name:s,cost:i})});const t=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(n=>{var c,l;const a=n.dataset.id,s=((c=n.querySelector(".pe-tname"))==null?void 0:c.value.trim())||a,i=parseFloat((l=n.querySelector(".pe-markup"))==null?void 0:l.value)||1,o=Array.from(n.querySelectorAll(".pe-fixed-check:checked")).map(f=>f.value),r=Array.from(n.querySelectorAll(".pe-var-check:checked")).map(f=>f.value);t.push({id:a,name:s,markup:i,fixed_cost_refs:o,variable_cost_refs:r})}),{library:e,templates:t}}function p(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function j(e){return new Map(e.map(t=>[t.id,t]))}function F(e,t,n){const a=e.fixed_cost_refs.reduce((r,c)=>{var l;return r+(((l=t.get(c))==null?void 0:l.cost)??0)},0),s=e.variable_cost_refs.reduce((r,c)=>{var l;return r+(((l=t.get(c))==null?void 0:l.cost)??0)},0),i=a/n+s,o=Math.ceil(i*e.markup);return{fixedTotal:a,variableTotal:s,costPerPerson:i,sellingPrice:o}}function U(e){P(e),window.addEventListener("pricingDataUpdated",t=>{P(t.detail)})}function P(e){var a;const t=document.getElementById("extras-picker");if(!t||((a=t.querySelector('optgroup[label="Experiences"]'))==null||a.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(s=>{const i=document.createElement("option");i.value=`pe_${s.id}|${s.name}`,i.textContent=`🧭 ${s.name}`,n.appendChild(i)}),t.appendChild(n)}async function J(e,t){var a,s,i;t=Math.max(1,Math.floor(t));const n=(a=window.extraServices)==null?void 0:a.find(o=>o.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const o=await h(),r=o.templates.find(f=>f.id===n.templateId);if(!r)return;const c=V(),{sellingPrice:l}=F(r,j(o.library),t);n.pax=t,n.spppIdr=l,n.unitUsd=c>0?l*t/c:0,(s=window.renderExtraServices)==null||s.call(window),(i=window.markDraftActive)==null||i.call(window)}catch(o){console.error("[PricingEngine] recalculate failed:",o)}}function V(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}let w=[];const y=new Map;async function z(){const e=document.getElementById("pe-chat-input"),t=document.getElementById("pe-chat-send"),n=document.getElementById("pe-chat-messages");if(!e||!n)return;const a=e.value.trim();if(a){E(n,"user",a),e.value="",t&&(t.disabled=!0,t.textContent="…"),n.scrollTop=n.scrollHeight;try{const i=await(await fetch("/api/pricing-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:a,pricingData:window._pricingData,history:w})})).json();if(w.push({role:"user",content:a}),i.reply&&(w.push({role:"assistant",content:i.reply}),E(n,"assistant",i.reply)),i.toolCall){const o="pe-action-"+Date.now();y.set(o,i.toolCall),K(n,o,i.toolCall)}}catch{E(n,"assistant","⚠ Request failed. Try again.")}t&&(t.disabled=!1,t.textContent="Send"),n.scrollTop=n.scrollHeight}}function W(e){var s;const t=y.get(e);if(!t)return;y.delete(e);const{name:n,input:a}=t;n==="add_library_item"?A(a):n==="create_template"?S(a):n==="update_cost"&&L(a.id,a.cost),(s=document.getElementById(e))==null||s.remove(),X()}function G(e){var t;y.delete(e),(t=document.getElementById(e))==null||t.remove()}function E(e,t,n){const a=document.createElement("div");a.className=`pe-chat-msg pe-chat-msg-${t}`,a.textContent=n,e.appendChild(a)}function K(e,t,n){const a=document.createElement("div");a.className="pe-action-card",a.id=t,a.innerHTML=`
    <div class="pe-action-label">${Q(n)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${t}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${t}')">Dismiss</button>
    </div>
  `,e.appendChild(a)}function Q({name:e,input:t}){const n=a=>Number(a).toLocaleString("id-ID");return e==="add_library_item"?`Add "${t.name}" — IDR ${n(t.cost)}`:e==="create_template"?`Create template "${t.name}" (markup ×${t.markup})`:e==="update_cost"?`Update ${t.id} → IDR ${n(t.cost)}`:e}function X(){const e=document.getElementById("pe-save-btn");e&&(e.classList.add("pe-save-pulse"),setTimeout(()=>e.classList.remove("pe-save-pulse"),2e3))}window.openPricingAdmin=I,window.closePricingAdmin=T,window.switchPeTab=v,window.savePricingAdmin=$,window.addPeLibraryRow=_,window.removePeLibraryRow=D,window.addPeTemplate=M,window.removePeTemplate=B,window.enforceMutualExclusion=q,window.recalculatePeExtra=J,window.sendPeChat=z,window.applyPeAction=W,window.dismissPeAction=G;async function x(){try{const e=await h();window._pricingData=e,U(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",x):x()})();
