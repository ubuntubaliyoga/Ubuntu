// js/bizdev.js — Leadgen tab

const LG_BILLBOARD = [
  '91% of B2B buyers arrive at their first sales meeting already familiar with the vendor.',
  'Buyers change their problem statement an average of 3.1 times during a complex purchase cycle.',
  'The average buying group now includes 10–11 stakeholders, sometimes rising to 15+ for enterprise deals.',
  '79% of B2B purchases now require final approval from the CFO.',
  '80% of B2B sales interactions will occur via digital channels by end of 2026.',
  '61% of buyers prefer a rep-free experience for the initial research phase.',
  '86% of buyers are willing to pay more for a superior customer experience.',
  '84% of B2B buyers start their purchasing process with a referral.',
  '84% of buyers ultimately choose vendors they have successfully worked with in the past.',
  '90% of deals are won by vendors who were on the buyer\'s initial consideration list.',
  'The average cold email response rate in 2026 sits around 5.1%.',
  'Advanced personalization referencing specific triggers can increase response rates to 18%.',
  'LinkedIn outreach delivers roughly double the response rate of cold email.',
  '80% of sales require 5+ follow-ups, yet 48% of reps never follow up after the first attempt.',
  '31% of decision-makers still report excellent ROI from cold calling despite a 2.3% success rate.',
  'Calls made between 4–5 PM local time are 71% more effective than midday attempts.',
  'Wednesdays perform 50% better for first-attempt conversations than Mondays.',
  '80% of cold calls go to voicemail — 90% of those voicemails are never returned.',
  'Reps who use social selling are 51% more likely to hit their quota.',
  'Only 17.2% of companies use interactive demos, yet they are among the top tools for reducing buyer uncertainty.',
  '81% of sales teams now use AI in some capacity, up from 50% in 2024.',
  'Teams using AI are 1.3× more likely to see revenue growth.',
  'Sales reps spend on average only 2 hours per day actually selling — the rest is admin and research.',
  'By end of 2026, AI is expected to handle over 30% of initial outbound outreach.',
  'AI has reduced the research-to-outreach cycle from 15+ minutes to under 60 seconds.',
  'Organizations using intent-signal data report 47% better conversion rates than traditional lead scoring.',
  'Companies using a CRM effectively are 86% more likely to exceed their targets.',
  'Multi-source data waterfalls now provide 85–95% coverage, making single-vendor stacks obsolete.',
  'Personalized video in outreach can increase open-to-reply rates by 26%.',
  'B2B e-commerce is growing 26× faster than the overall B2B market.',
  'Buyers already know your features — explain why they solve their specific problems right now.',
  'Identify the hidden stakeholders in the first 2 weeks of a deal.',
  'Reach out after a prospect\'s funding announcement, new hire, or technology pivot.',
  'The most successful discovery calls include 11–14 questions.',
  '91% of customers say they\'d give a referral, but only 11% of reps ever ask.',
  'It is 5× cheaper to grow an existing account than to acquire a new one.',
  'If your website has no self-service demo or pricing, you\'re losing 60% of the silent market.',
  'Use the first meeting to diagnose rather than prescribe.',
  'ESG fit is now a top-5 procurement criteria — align your partnerships with sustainability.',
  'Use AI for research, but use your human voice for the final edit.',
  'The average B2B sales cycle now spans nearly a full year — prepare for the long game.',
  'Build systems where one happy customer automatically feeds into the next lead.',
  'The best deals in 2026 are often product integrations — bring product managers into BD planning.',
  'Always create a 1-page executive summary for the CFO focusing on ROI and risk mitigation.',
  'Using 3+ channels — email, phone, LinkedIn — increases connection probability by 400%.',
  'Verified contact databases increase answer rates to 13.3%.',
  'Being honest about what your product cannot do builds more trust than a perfect pitch.',
  '79% of prospects reply to cold outreach not to buy, but to ask for more information.',
  'Review and pivot your sales strategy every 90 days, not annually.',
  'As AI floods inboxes, the value of a handwritten note or face-to-face meeting is at an all-time high.',
];

let _billboardTimer = null;
let _billboardIdx   = 0;

function lgBillboardStart() {
  const box  = document.getElementById('lg-billboard');
  const text = document.getElementById('lg-billboard-text');
  if (!box || !text) return;
  _billboardIdx = Math.floor(Math.random() * LG_BILLBOARD.length);
  box.style.display = 'block';
  text.textContent = LG_BILLBOARD[_billboardIdx];
  _billboardTimer = setInterval(() => {
    text.style.opacity = '0';
    setTimeout(() => {
      _billboardIdx = (_billboardIdx + 1) % LG_BILLBOARD.length;
      text.textContent = LG_BILLBOARD[_billboardIdx];
      text.style.opacity = '1';
    }, 400);
  }, 5000);
}

function lgBillboardStop() {
  clearInterval(_billboardTimer);
  _billboardTimer = null;
  const box = document.getElementById('lg-billboard');
  if (box) box.style.display = 'none';
}

const LG_CITIES = [
  // Europe
  'Amsterdam','London','Berlin','Paris','Barcelona','Lisbon','Madrid','Rome','Milan',
  'Vienna','Zurich','Stockholm','Copenhagen','Oslo','Helsinki','Prague','Budapest',
  'Athens','Brussels','Dublin','Porto','Seville','Valencia','Florence','Venice',
  'Munich','Hamburg','Cologne','Warsaw','Krakow','Riga','Tallinn','Ljubljana',
  'Dubrovnik','Split','Montenegro','Santorini','Ibiza','Mallorca','Tenerife',
  // Americas
  'New York','Los Angeles','San Francisco','Miami','Chicago','Austin','Seattle',
  'Toronto','Vancouver','Montreal','Mexico City','Tulum','Playa del Carmen',
  'Nosara','Santa Teresa','Buenos Aires','Medellin','Bogota','Lima','Cusco',
  'Rio de Janeiro','São Paulo','Oaxaca','Puerto Vallarta','Sayulita',
  // Asia-Pacific
  'Bali','Canggu','Ubud','Seminyak','Chiang Mai','Bangkok','Koh Samui','Koh Phangan',
  'Singapore','Tokyo','Kyoto','Seoul','Hong Kong','Shanghai','Goa','Mumbai',
  'Rishikesh','Sydney','Melbourne','Auckland','Byron Bay','Queenstown',
  // Middle East & Africa
  'Dubai','Abu Dhabi','Tel Aviv','Cape Town','Marrakech','Cairo',
  // North America wellness hubs
  'Sedona','Santa Fe','Asheville','Portland','Boulder','Ojai','Topanga',
];

let _lgRunning     = false;
let _lgRecentCities = [];

function lgInit() { /* datalist replaced by custom dropdown — nothing to init */ }

// ── Custom city autocomplete ──────────────────────────────────────────────────
function lgCityFilter() {
  const inp  = document.getElementById('lg-city');
  const drop = document.getElementById('lg-city-drop');
  if (!drop) return;
  const val = (inp?.value || '').trim().toLowerCase();
  if (!val) { drop.style.display = 'none'; return; }
  const matches = LG_CITIES.filter(c => c.toLowerCase().includes(val)).slice(0, 8);
  if (!matches.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = matches.map(c =>
    `<div style="padding:12px 16px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);cursor:pointer;border-bottom:1px solid var(--border);"
      onmousedown="lgPickCity('${c.replace(/'/g, "\\'")}')">
      ${c.replace(new RegExp('('+val.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')', 'i'), '<strong>$1</strong>')}
    </div>`
  ).join('');
  drop.style.display = 'block';
}

function lgPickCity(city) {
  const inp = document.getElementById('lg-city');
  if (inp) { inp.value = city; inp.blur(); }
  lgCityClear();
}

function lgCityClear() {
  const drop = document.getElementById('lg-city-drop');
  if (drop) drop.style.display = 'none';
}

// ── Random city (no recent repeats) ──────────────────────────────────────────
function lgRandomCity() {
  const btn = document.getElementById('lg-dice-btn');
  const inp = document.getElementById('lg-city');
  if (!btn || !inp) return;

  // Exclude last 20 picks so the same city doesn't recur quickly
  const pool = LG_CITIES.filter(c => !_lgRecentCities.includes(c));
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  _lgRecentCities.push(chosen);
  if (_lgRecentCities.length > 20) _lgRecentCities.shift();

  inp.value = '';
  lgCityClear();
  btn.style.pointerEvents = 'none';
  btn.innerHTML = `<span class="dice-rolling">🎲</span>`;
  setTimeout(() => {
    btn.innerHTML = '🎲';
    btn.style.pointerEvents = '';
    inp.value = chosen;
  }, 1500);
}

async function lgGenerate() {
  if (_lgRunning) return;
  const city = (document.getElementById('lg-city')?.value || '').trim();
  if (!city) { lgStatus('Enter a city first.', 'warn'); return; }

  _lgRunning = true;
  const btn = document.getElementById('lg-generate-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
  lgStatus(`🔍 Scanning Instagram for retreat leaders in ${city}…`, 'loading');
  document.getElementById('lg-results')?.replaceChildren();
  lgBillboardStart();

  try {
    const res  = await fetch('/api/leadgen-agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ city }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    const data = await res.json();
    if (data._log) console.log('[leadgen trace]', data._log.join('\n'));
    const added   = (data.leads || []).filter(l => l.status === 'added').length;
    const skipped = (data.leads || []).filter(l => l.status === 'skipped').length;
    lgStatus(`✅ ${added} leads added to Notion${skipped ? ` · ${skipped} skipped (duplicate)` : ''} — ${city}`, 'ok');
    lgRenderLeads(data.leads || [], data._log || []);
  } catch (e) {
    lgStatus('Error: ' + e.message, 'error');
    console.error('[leadgen]', e);
    if (typeof dbg === 'function') dbg('Leadgen error: ' + e.message);
  } finally {
    _lgRunning = false;
    lgBillboardStop();
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Leads'; }
  }
}

function lgStatus(msg, type) {
  const el = document.getElementById('lg-status');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = msg ? 'block' : 'none';
  el.style.color   = type === 'error' ? '#c62828' : type === 'ok' ? '#2E7D32' : type === 'warn' ? '#e65100' : 'var(--muted)';
}

function lgRenderLeads(leads, log) {
  const el = document.getElementById('lg-results');
  if (!el) return;
  const traceHtml = log?.length
    ? `<details style="margin-top:16px;font-size:11px;color:var(--muted);"><summary style="cursor:pointer;user-select:none;padding:4px 0;">🔍 Debug trace</summary><pre style="white-space:pre-wrap;line-height:1.6;margin-top:6px;font-family:'SF Mono',monospace;">${esc(log.join('\n'))}</pre></details>`
    : '';
  if (!leads.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No leads found. Try a different city.${traceHtml}</div>`;
    return;
  }
  el.innerHTML = leads.map(lead => {
    const added   = lead.status === 'added';
    const skipped = lead.status === 'skipped';
    const badge   = added ? '✅ Added' : skipped ? '⏭️ Skipped' : '⚠️ Error';
    const badgeC  = added ? '#2E7D32' : skipped ? '#888' : '#c62828';
    const srcIcon = lead.source === 'instagram' ? '📸' : '📍';
    const srcLabel = lead.source === 'instagram' ? 'Instagram' : 'Google Maps';
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;margin-bottom:12px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <div style="min-width:0;">
          <div style="font-size:15px;font-weight:700;color:var(--dark);margin-bottom:3px;">${esc(lead.name)}</div>
          <div style="font-size:11px;color:var(--muted);">${srcIcon} ${srcLabel}${lead.insta ? ` · ${esc(lead.insta)}` : ''}</div>
        </div>
        <div style="font-size:11px;font-weight:600;color:${badgeC};flex-shrink:0;white-space:nowrap;">${badge}</div>
      </div>
      ${lead.retreat ? `<div style="font-size:12px;color:var(--text);margin-bottom:8px;padding:6px 10px;background:var(--bg);border-radius:var(--radius-sm);">🎯 ${esc(lead.retreat)}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px;">
        ${lead.waLink  ? `<a href="${esc(lead.waLink)}"  target="_blank" rel="noopener" class="crm-action-btn crm-wa-btn">WA</a>` : ''}
        ${lead.insta   ? `<a href="https://instagram.com/${esc(lead.insta.replace(/^@/,''))}" target="_blank" rel="noopener" class="crm-action-btn crm-ig-btn">IG</a>` : ''}
        ${lead.website ? `<a href="${esc(lead.website)}" target="_blank" rel="noopener" class="crm-action-btn crm-web-btn">www</a>` : ''}
        ${lead.phone   ? `<span style="font-size:12px;color:var(--muted);padding:8px 0;">📞 ${esc(lead.phone)}</span>` : ''}
        ${lead.email   ? `<span style="font-size:12px;color:var(--muted);padding:8px 0;">✉️ ${esc(lead.email)}</span>` : ''}
        ${!lead.waLink && !lead.phone ? `<span style="font-size:12px;color:var(--muted);font-style:italic;padding:8px 0;">no number</span>` : ''}
      </div>
    </div>`;
  }).join('') + traceHtml;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
