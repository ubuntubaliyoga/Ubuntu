// js/bizdev.js — Leadgen tab

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
  if (!leads.length) {
    const trace = log?.length ? `<details style="margin-top:12px;font-size:11px;color:var(--muted);"><summary style="cursor:pointer;">Debug trace</summary><pre style="white-space:pre-wrap;line-height:1.6;margin-top:6px;">${esc(log.join('\n'))}</pre></details>` : '';
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No leads found. Try a different city.${trace}</div>`;
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
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
