(function(){"use strict";let v=null;async function g(){if(v)return v;const e=await fetch("/data/pricing.json?t="+Date.now());if(!e.ok)throw new Error(`Failed to load pricing data: ${e.status}`);return v=await e.json(),v}async function _(e){const t=await fetch("/api/save-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!t.ok){const n=await t.json().catch(()=>({}));throw new Error(n.message??"Save failed")}v=e}let s=null,p="library",f=null;function D(){g().then(e=>{var t;s=JSON.parse(JSON.stringify(e)),U(),(t=document.getElementById("pricing-overlay"))==null||t.classList.add("open")})}function M(){var e;f&&(clearTimeout(f),w(!0)),(e=document.getElementById("pricing-overlay"))==null||e.classList.remove("open")}function y(e){var t;s&&(p==="library"?s={...s,library:S()}:s={...s,templates:A()}),p=e,T(),document.querySelectorAll(".pe-tab").forEach(n=>n.classList.remove("active")),(t=document.getElementById(`pe-tab-${e}`))==null||t.classList.add("active")}function u(){const e=document.getElementById("pe-autosave-status");e&&(e.textContent="● Unsaved changes"),f&&clearTimeout(f),f=setTimeout(()=>w(!0),2e3)}async function w(e=!1){const t=document.getElementById("pe-save-btn"),n=document.getElementById("pe-autosave-status");!e&&t&&(t.textContent="Saving…",t.disabled=!0),n&&(n.textContent="○ Saving…");try{s&&(p==="library"?s={...s,library:S()}:s={...s,templates:A()});const i=s;await _(i),window.dispatchEvent(new CustomEvent("pricingDataUpdated",{detail:i})),!e&&t&&(t.textContent="Saved!",setTimeout(()=>{t&&(t.textContent="Save Changes",t.disabled=!1)},2e3)),n&&(n.textContent="✓ Saved"),f=null}catch(i){!e&&t&&(t.textContent="Error — retry",t.disabled=!1),n&&(n.textContent="⚠ Save failed"),console.error("[PricingEngine] Save failed:",i)}}function B(e){p!=="library"&&y("library");const t=document.getElementById("pe-library-tbody");if(!t)return;const n=document.createElement("tr");n.dataset.id=e.id,n.innerHTML=E(e),t.appendChild(n),n.scrollIntoView({behavior:"smooth",block:"nearest"}),u()}function q(e){var i,o;if(!s)return;p!=="templates"&&y("templates");const t=document.getElementById("pe-templates-list");if(!t)return;const n=document.createElement("div");n.innerHTML=P(e,s.library),t.appendChild(n.firstElementChild),(o=(i=n.firstElementChild)==null?void 0:i.scrollIntoView)==null||o.call(i,{behavior:"smooth",block:"nearest"}),u()}function R(e,t){p!=="library"&&y("library"),document.querySelectorAll("#pe-library-tbody tr").forEach(n=>{n.dataset.id===e&&(n.querySelector(".pe-lib-cost").value=String(t),n.scrollIntoView({behavior:"smooth",block:"nearest"}))}),u()}function H(){var n;const e=document.getElementById("pe-library-tbody");if(!e)return;const t=document.createElement("tr");t.dataset.id="_new_"+Date.now(),t.innerHTML=E({id:"",name:"",cost:0},!0),e.appendChild(t),(n=t.querySelector(".pe-lib-id"))==null||n.focus(),u()}function N(e){var t;(t=e.closest("tr"))==null||t.remove(),u()}function j(){const e=document.getElementById("pe-templates-list");if(!e||!s)return;const t={id:"TEMPLATE_"+Date.now(),name:"New Template",fixed_cost_refs:[],variable_cost_refs:[],markup:1.4},n=document.createElement("div");n.innerHTML=P(t,s.library),e.appendChild(n.firstElementChild),u()}function O(e){var t;(t=e.closest(".pe-template-card"))==null||t.remove(),u()}function F(e){var a;const t=e.value;if(!t||!s)return;e.value="";const n=e.closest(".pe-template-card");if(!n||n.querySelector(`.pe-cost-chip[data-item-id="${t}"]`))return;const i=s.library.find(r=>r.id===t);if(!i)return;const o=document.createElement("div");o.className="pe-cost-chip",o.dataset.itemId=t,o.innerHTML=k(i.id,i.name,!1),(a=n.querySelector(".pe-cost-chips"))==null||a.appendChild(o),u()}function U(){const e=document.getElementById("pricing-overlay");e&&(e.innerHTML=`
    <div class="pe-panel" oninput="window.triggerPeAutosave()" onchange="window.triggerPeAutosave()">
      <div class="pe-header">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="pe-title">Cost Calculation</div>
          <div id="pe-autosave-status" style="font-size:10px; color:var(--text-dim); font-family:monospace;">✓ Saved</div>
        </div>
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
  `,T())}function T(){const e=document.getElementById("pe-tab-body");!e||!s||(e.innerHTML=p==="library"?J(s.library):z(s.templates,s.library))}function J(e){return`
    <div class="pe-section-hint">Costs in IDR. IDs are referenced by templates — change with care.</div>
    <table class="pe-table">
      <thead><tr><th>ID</th><th>Name</th><th style="text-align:right;">Cost (IDR)</th><th></th></tr></thead>
      <tbody id="pe-library-tbody">${e.map(n=>`<tr data-id="${l(n.id)}">${E(n)}</tr>`).join("")}</tbody>
    </table>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeLibraryRow()">＋ Add Item</button>
  `}function E(e,t=!1){return`
    <td><input class="pe-input pe-lib-id"   value="${l(e.id)}"   placeholder="ITEM_ID" style="width:130px;font-family:monospace;font-size:12px;"></td>
    <td><input class="pe-input pe-lib-name" value="${l(e.name)}" placeholder="Name"    style="width:100%;"></td>
    <td><input class="pe-input pe-lib-cost" type="number" value="${e.cost}" min="0" step="1" style="width:100px;text-align:right;"></td>
    <td><button class="pe-del-btn" onclick="window.removePeLibraryRow(this)" title="Remove">✕</button></td>
  `}function z(e,t){return`
    <div id="pe-templates-list">${e.map(n=>P(n,t)).join("")}</div>
    <button class="pill-btn" style="margin-top:12px;" onclick="window.addPeTemplate()">＋ Add Template</button>
  `}function k(e,t,n){return`
    <span class="pe-chip-name">${l(t)} <span class="pe-check-id">${l(e)}</span></span>
    <label class="pe-fixed-label">
      <input type="checkbox" class="pe-fixed-check" value="${l(e)}" ${n?"checked":""}>
      fixed ÷pax
    </label>
    <button class="pe-del-btn" onclick="this.closest('.pe-cost-chip').remove()" title="Remove">✕</button>
  `}function P(e,t){const i=[...e.fixed_cost_refs,...e.variable_cost_refs].map(a=>{const r=t.find(c=>c.id===a);return r?`<div class="pe-cost-chip" data-item-id="${l(a)}">${k(a,r.name,e.fixed_cost_refs.includes(a))}</div>`:""}).join(""),o=t.map(a=>`<option value="${l(a.id)}">${l(a.name)}</option>`).join("");return`
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
          ${o}
        </select>
        <div class="pe-cost-chips">${i}</div>
      </div>
    </div>
  `}function S(){const e=[];return document.querySelectorAll("#pe-library-tbody tr[data-id]").forEach(t=>{var a,r,c;const n=(a=t.querySelector(".pe-lib-id"))==null?void 0:a.value.trim(),i=(r=t.querySelector(".pe-lib-name"))==null?void 0:r.value.trim(),o=parseFloat((c=t.querySelector(".pe-lib-cost"))==null?void 0:c.value)||0;n&&i&&e.push({id:n,name:i,cost:o})}),e}function A(){const e=[];return document.querySelectorAll(".pe-template-card[data-id]").forEach(t=>{var c,m;const n=t.dataset.id,i=((c=t.querySelector(".pe-tname"))==null?void 0:c.value.trim())||n,o=parseFloat((m=t.querySelector(".pe-markup"))==null?void 0:m.value)||1,a=[],r=[];t.querySelectorAll(".pe-cost-chip[data-item-id]").forEach(d=>{const h=d.dataset.itemId,I=d.querySelector(".pe-fixed-check");I!=null&&I.checked?a.push(h):r.push(h)}),e.push({id:n,name:i,markup:o,fixed_cost_refs:a,variable_cost_refs:r})}),e}function l(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function V(e){return new Map(e.map(t=>[t.id,t]))}function W(e,t,n){const i=e.fixed_cost_refs.reduce((c,m)=>{var d;return c+(((d=t.get(m))==null?void 0:d.cost)??0)},0),o=e.variable_cost_refs.reduce((c,m)=>{var d;return c+(((d=t.get(m))==null?void 0:d.cost)??0)},0),a=i/n+o,r=Math.ceil(a*e.markup);return{fixedTotal:i,variableTotal:o,costPerPerson:a,sellingPrice:r}}function G(e){$(e),window.addEventListener("pricingDataUpdated",t=>{$(t.detail)})}function $(e){var i;const t=document.getElementById("extras-picker");if(!t||((i=t.querySelector('optgroup[label="Experiences"]'))==null||i.remove(),!e.templates.length))return;const n=document.createElement("optgroup");n.label="Experiences",e.templates.forEach(o=>{const a=document.createElement("option");a.value=`pe_${o.id}|${o.name}`,a.textContent=`🧭 ${o.name}`,n.appendChild(a)}),t.appendChild(n)}async function K(e,t){var i,o,a;t=Math.max(1,Math.floor(t));const n=(i=window.extraServices)==null?void 0:i.find(r=>r.id===e);if(!(!(n!=null&&n.pricingEngine)||!n.templateId))try{const r=await g(),c=r.templates.find(h=>h.id===n.templateId);if(!c)return;const m=Q(),{sellingPrice:d}=W(c,V(r.library),t);n.pax=t,n.spppIdr=d,n.unitUsd=m>0?d*t/m:0,(o=window.renderExtraServices)==null||o.call(window),(a=window.markDraftActive)==null||a.call(window)}catch(r){console.error("[PricingEngine] recalculate failed:",r)}}function Q(){var e;return parseFloat(((e=document.getElementById("f-idrrate"))==null?void 0:e.value)??"")||17085}let x=[];const b=new Map;async function X(){const e=document.getElementById("pe-chat-input"),t=document.getElementById("pe-chat-send"),n=document.getElementById("pe-chat-messages");if(!e||!n)return;const i=e.value.trim();if(i){C(n,"user",i),e.value="",t&&(t.disabled=!0,t.textContent="…"),n.scrollTop=n.scrollHeight;try{const a=await(await fetch("/api/pricing-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:i,pricingData:window._pricingData,history:x})})).json();if(x.push({role:"user",content:i}),a.reply&&(x.push({role:"assistant",content:a.reply}),C(n,"assistant",a.reply)),a.toolCall){const r="pe-action-"+Date.now();b.set(r,a.toolCall),ee(n,r,a.toolCall)}}catch{C(n,"assistant","⚠ Request failed. Try again.")}t&&(t.disabled=!1,t.textContent="Send"),n.scrollTop=n.scrollHeight}}function Y(e){var o;const t=b.get(e);if(!t)return;b.delete(e);const{name:n,input:i}=t;n==="add_library_item"?B(i):n==="create_template"?q(i):n==="update_cost"&&R(i.id,i.cost),(o=document.getElementById(e))==null||o.remove(),ne()}function Z(e){var t;b.delete(e),(t=document.getElementById(e))==null||t.remove()}function C(e,t,n){const i=document.createElement("div");i.className=`pe-chat-msg pe-chat-msg-${t}`,i.textContent=n,e.appendChild(i)}function ee(e,t,n){const i=document.createElement("div");i.className="pe-action-card",i.id=t,i.innerHTML=`
    <div class="pe-action-label">${te(n)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="pill-btn dark" onclick="window.applyPeAction('${t}')">Apply</button>
      <button class="pill-btn" onclick="window.dismissPeAction('${t}')">Dismiss</button>
    </div>
  `,e.appendChild(i)}function te({name:e,input:t}){const n=i=>Number(i).toLocaleString("id-ID");return e==="add_library_item"?`Add "${t.name}" — IDR ${n(t.cost)}`:e==="create_template"?`Create template "${t.name}" (markup ×${t.markup})`:e==="update_cost"?`Update ${t.id} → IDR ${n(t.cost)}`:e}function ne(){const e=document.getElementById("pe-save-btn");e&&(e.classList.add("pe-save-pulse"),setTimeout(()=>e.classList.remove("pe-save-pulse"),2e3))}window.openPricingAdmin=D,window.closePricingAdmin=M,window.switchPeTab=y,window.savePricingAdmin=w,window.triggerPeAutosave=u,window.addPeLibraryRow=H,window.removePeLibraryRow=N,window.addPeTemplate=j,window.removePeTemplate=O,window.peAddCostItem=F,window.recalculatePeExtra=K,window.sendPeChat=X,window.applyPeAction=Y,window.dismissPeAction=Z;async function L(){try{const e=await g();window._pricingData=e,G(e)}catch(e){console.error("[PricingEngine] Failed to load pricing data:",e)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",L):L()})();
