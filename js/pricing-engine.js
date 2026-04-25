(function(){"use strict";let m=null;async function h(){if(m)return m;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return m=await e.json(),m}async function A(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}m=e}let o=null,p="library";function S(){h().then(e=>{var t;o=JSON.parse(JSON.stringify(e)),O(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function L(){var e;(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function f(e){var t;o&&(p==="library"?o={...o,library:k()}:o={...o,templates:x()}),p=e,C(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}async function _(){const e=document.getElementById("pe-save-btn");if(!e)return;const t=e.textContent;e.textContent="Saving…",e.disabled=!0;try{o&&(p==="library"?o={...o,library:k()}:o={...o,templates:x()});const n=o;await A(n),window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:n})),e.textContent="Saved!",setTimeout(()=>{e.textContent=t,e.disabled=!1},2e3)}catch(n){e.textContent="Error — retry",e.disabled=!1,console.error("[PricingEngine] Save failed:",n)}}function D(e){p!=="library"&&f("library");const t=document.getElementById("pe-library-tbody");if(!t)return;const n=document.createElement("tr");n.dataset.id=e.id,n.innerHTML=v(e),t.appendChild(n),n.scrollIntoView({behavior:"smooth",block:"nearest"})}function M(e){var i,s;if(!o)return;p!=="templates"&&f("templates");const t=document.getElementById("pe-templates-list");if(!t)return;const n=document.createElement("div");n.innerHTML=w(e,o.library),t.appendChild(n.firstElementChild),(s=(i=n.firstElementChild)==null?void 0:i.scrollIntoView)==null||s.call(i,{behavior:"smooth",block:"nearest"})}function B(e,t){p!=="library"&&f("library"),document.querySelectorAll("#pe-library-tbody tr").forEach(n=>{n.dataset.id===e&&(n.querySelector(".pe-lib-cost").value=String(t),n.scrollIntoView({behavior:"smooth",block:"nearest"}))})}function q(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=v({id:"",name:"",cost:0},!0),e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus()}function R(e){var t;(t=e.closest("tr"))==null||t.remove()}function H(){const e=document.getElementById("pe-templates-list");if(!e||!o)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=w(t,o.library),e.appendChild(n.firstElementChild)}function N(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove()}function j(e){var a;const t=e.value;if(!t||!o)return;e.value="";const n=e.closest(".pe-template-card");if(!n||n.querySelector(`.pe-cost-chip[data-item-id="${t}"]`))return;const i=o.library.find(c=>c.id===t);if(!i)return;const s=document.createElement("div");s.className="pe-cost-chip",s.dataset.itemId=t,s.innerHTML=I(i.id,i.name,!1),(a=n.querySelector(".pe-cost-chips"))==null||a.appendChild(s)}function O(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel">
      <div class="pe-header">
        <div class="pe-title">Cost Calculation</div>
        <button class="pe-header-close" onclick="window.closePricingAdmin()">✕</button>
      </div>
      <div class="pe-tabs">
        <button class="pe-tab${p==="library"?" active":""}" id="pe-tab-library"
          onclick="window.switchPeTab('library')">Library</button>
        <button class="pe-tab${p==="templates"?" active":""}" id="pe-tab-templates"
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
  `,C())}function C(){const e=document.getElementById("pe-tab-body");!e||!o||(e.innerHTML=p==="library"?F(o.library):U(o.templates,o.library))}function F(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`<tr data-id="${l(n.id)}">${v(n)}</tr>`).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function v(e,t=!1){return`
    <td><input class="pe-input pe-lib-id"   value="${l(e.id)}"   placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="${l(e.name)}" placeholder="Name"    style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${e.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `}function U(e,t){return`
    <div id="pe-templates-list">${e.map(n=>w(n,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function I(e,t,n){return`
    <span class="pe-chip-name">${l(t)} <span class="pe-check-id">${l(e)}</span></span>
    <label class="pe-fixed-label">
      <input type="checkbox" class="pe-fixed-check" value="${l(e)}" ${n?"checked":""}>
      fixed ÷pax
    </label>
    <button class="pe-del-btn" onclick="this.closest('.pe-cost-chip').remove()" title="Remove">✕</button>
  `}function w(e,t){const i=[...e.fixed_cost_refs,...e.variable_cost_refs].map(a=>{const c=t.find(r=>r.id===a);return c?`<div class="pe-cost-chip" data-item-id="${l(a)}">${I(a,c.name,e.fixed_cost_refs.includes(a))}</div>`:""}).join(""),s=t.map(a=>`<option value="${l(a.id)}">${l(a.name)}</option>`).join("");return`
    <div class="pe-template-card" data-id="${l(e.id)}">
      <div class="pe-template-card-head">
        <div style="flex:1;">
          <input class="pe-input pe-tname" value="${l(e.name)}" placeholder="Template name"
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
          ${s}
        </select>
        <div class="pe-cost-chips">${i}</div>
      </div>
    </div>
  `}function k(){const e=[];return document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(t=>{var a,c,r;const n=(a=t.querySelector(".pe-lib-id"))==null?void 0:a.value.trim(),i=(c=t.querySelector(".pe-lib-name"))==null?void 0:c.value.trim(),s=parseFloat((r=t.querySelector(".pe-lib-cost"))==null?void 0:r.value)||0;n&&i&&e.push({id:n,name:i,cost:s})}),e}function x(){const e=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(t=>{var r,u;const n=t.dataset.id,i=((r=t.querySelector(".pe-tname"))==null?void 0:r.value.trim())||n,s=parseFloat((u=t.querySelector(".pe-markup"))==null?void 0:u.value)||1,a=[],c=[];t.querySelectorAll(".pe-cost-chip[data-item-id]").forEach(d=>{const y=d.dataset.itemId,P=d.querySelector(".pe-fixed-check");P!=null&&P.checked?a.push(y):c.push(y)}),e.push({id:n,name:i,markup:s,fixed_cost_refs:a,variable_cost_refs:c})}),e}function l(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function J(e){return new Map(e.map(t=>[t.id,t]))}function V(e,t,n){const i=e.fixed_cost_refs.reduce((r,u)=>{var d;return r+(((d=t.get(u))==null?void 0:d.cost)??0)},0),s=e.variable_cost_refs.reduce((r,u)=>{var d;return r+(((d=t.get(u))==null?void 0:d.cost)??0)},0),a=i/n+s,c=Math.ceil(a*e.markup);return{fixedTotal:i,variableTotal:s,costPerPerson:a,sellingPrice:c}}function z(e){T(e),window.addEventListener("pricingDataUpdated",t=>{T(t.detail)})}function T(e){var i;const t=document.getElementById("extras-picker");if(!t||((i=t.querySelector('optgroup[label="Experiences"]'))==null||i.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(s=>{const a=document.createElement("option");a.value=`pe_${s.id}|${s.name}`,a.textContent=`🧭 ${s.name}`,n.appendChild(a)}),t.appendChild(n)}async function W(e,t){var i,s,a;t=Math.max(1,Math.floor(t));const n=(i=window.extraServices)==null?void 0:i.find(c=>c.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const c=await h(),r=c.templates.find(y=>y.id===n.templateId);if(!r)return;const u=G(),{sellingPrice:d}=V(r,J(c.library),t);n.pax=t,n.spppIdr=d,n.unitUsd=u>0?d*t/u:0,(s=window.renderExtraServices)==null||s.call(window),(a=window.markDraftActive)==null||a.call(window)}catch(c){console.error("[PricingEngine] recalculate failed:",c)}}function G(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}let g=[];const b=new Map;async function K(){const e=document.getElementById("pe-chat-input"),t=document.getElementById("pe-chat-send"),n=document.getElementById("pe-chat-messages");if(!e||!n)return;const i=e.value.trim();if(i){E(n,"user",i),e.value="",t&&(t.disabled=!0,t.textContent="…"),n.scrollTop=n.scrollHeight;try{const a=await(await fetch("/api/pricing-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:i,pricingData:window._pricingData,history:g})})).json();if(g.push({role:"user",content:i}),a.reply&&(g.push({role:"assistant",content:a.reply}),E(n,"assistant",a.reply)),a.toolCall){const c="pe-action-"+Date.now();b.set(c,a.toolCall),Y(n,c,a.toolCall)}}catch{E(n,"assistant","⚠ Request failed. Try again.")}t&&(t.disabled=!1,t.textContent="Send"),n.scrollTop=n.scrollHeight}}function Q(e){var s;const t=b.get(e);if(!t)return;b.delete(e);const{name:n,input:i}=t;n==="add_library_item"?D(i):n==="create_template"?M(i):n==="update_cost"&&B(i.id,i.cost),(s=document.getElementById(e))==null||s.remove(),ee()}function X(e){var t;b.delete(e),(t=document.getElementById(e))==null||t.remove()}function E(e,t,n){const i=document.createElement("div");i.className=`pe-chat-msg pe-chat-msg-${t}`,i.textContent=n,e.appendChild(i)}function Y(e,t,n){const i=document.createElement("div");i.className="pe-action-card",i.id=t,i.innerHTML=`
    <div class="pe-action-label">${Z(n)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${t}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${t}')">Dismiss</button>
    </div>
  `,e.appendChild(i)}function Z({name:e,input:t}){const n=i=>Number(i).toLocaleString("id-ID");return e==="add_library_item"?`Add "${t.name}" — IDR ${n(t.cost)}`:e==="create_template"?`Create template "${t.name}" (markup ×${t.markup})`:e==="update_cost"?`Update ${t.id} → IDR ${n(t.cost)}`:e}function ee(){const e=document.getElementById("pe-save-btn");e&&(e.classList.add("pe-save-pulse"),setTimeout(()=>e.classList.remove("pe-save-pulse"),2e3))}window.openPricingAdmin=S,window.closePricingAdmin=L,window.switchPeTab=f,window.savePricingAdmin=_,window.addPeLibraryRow=q,window.removePeLibraryRow=R,window.addPeTemplate=H,window.removePeTemplate=N,window.peAddCostItem=j,window.recalculatePeExtra=W,window.sendPeChat=K,window.applyPeAction=Q,window.dismissPeAction=X;async function $(){try{const e=await h();window._pricingData=e,z(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",$):$()})();
