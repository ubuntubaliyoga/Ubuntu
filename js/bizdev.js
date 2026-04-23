// js/bizdev.js

const LG_CITIES = [
  'Amsterdam', 'London', 'Berlin', 'New York', 'Los Angeles', 'Sydney',
  'Melbourne', 'Toronto', 'Zurich', 'Vienna', 'Barcelona', 'Lisbon',
  'Paris', 'Stockholm', 'Copenhagen', 'Vancouver', 'San Francisco',
  'Tulum', 'Ibiza', 'Cape Town', 'Singapore', 'Dubai', 'Tel Aviv',
  'Milan', 'Prague', 'Budapest', 'Athens', 'Oslo', 'Helsinki', 'Auckland',
  'Bali', 'Chiang Mai', 'Playa del Carmen', 'Nosara', 'Sedona',
];

let _lgVariant = 'a';
let _lgGenerated = false;

function lgRandomCity() {
  const city = LG_CITIES[Math.floor(Math.random() * LG_CITIES.length)];
  const el = document.getElementById('lg-city');
  if (el) { el.value = city; lgOnCityInput(); }
}

function lgOnCityInput() {
  // Reset generated state if city changes
  if (_lgGenerated) {
    const city = document.getElementById('lg-city')?.value.trim() || '';
    const label = document.getElementById('lg-city-label');
    if (label) label.textContent = city || 'your city';
    lgUpdate();
  }
}

function lgGenerate() {
  const city = document.getElementById('lg-city')?.value.trim() || '';
  const btn  = document.getElementById('lg-generate-btn');
  const results = document.getElementById('lg-results');
  const label   = document.getElementById('lg-city-label');

  if (!city) {
    if (btn) { btn.textContent = 'Enter a city first'; btn.style.opacity = '.6'; }
    setTimeout(() => { if (btn) { btn.textContent = 'Generate Leads'; btn.style.opacity = ''; } }, 1800);
    return;
  }

  _lgGenerated = true;
  if (results) results.style.display = 'block';
  if (label) label.textContent = city;
  if (btn) { btn.textContent = `Searching ${city}…`; btn.style.opacity = '.7'; }

  // Brief animation then reset button
  setTimeout(() => {
    if (btn) { btn.textContent = 'Generate Leads'; btn.style.opacity = ''; }
  }, 1200);

  lgUpdate();

  // Scroll results into view
  setTimeout(() => results?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}

function lgSetVariant(v) {
  _lgVariant = v;
  const a = document.getElementById('lg-var-a');
  const b = document.getElementById('lg-var-b');
  if (a) a.className = v === 'a' ? 'pill-btn dark' : 'pill-btn';
  if (b) b.className = v === 'b' ? 'pill-btn dark' : 'pill-btn';
  lgUpdate();
}

function lgBuildMessage(firstname, retreat) {
  const name = (firstname || '').trim() || '[First Name]';
  const ret  = (retreat  || '').trim();
  let hook;
  if (_lgVariant === 'a') {
    hook = `You are hosting the ${ret || '[Upcoming Retreat]'}, is that right?`;
  } else {
    hook = `You held the ${ret || '[Last Retreat]'}, is that right?`;
  }
  return `Dear ${name}, Kevin here from Bali.\n\n${hook}`;
}

function lgCopyMessage() {
  const firstname = document.getElementById('lg-firstname')?.value || '';
  const retreat   = document.getElementById('lg-retreat')?.value   || '';
  const msg = lgBuildMessage(firstname, retreat);
  const btn = document.getElementById('lg-copy-btn');
  const reset = () => { if (btn) btn.textContent = 'Copy'; };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(msg)
      .then(() => { if (btn) { btn.textContent = 'Copied ✓'; setTimeout(reset, 2000); } })
      .catch(() => _lgCopyFallback(msg, btn, reset));
  } else {
    _lgCopyFallback(msg, btn, reset);
  }
}

function _lgCopyFallback(text, btn, reset) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  if (btn) { btn.textContent = 'Copied ✓'; setTimeout(reset, 2000); }
}

function lgUpdate() {
  if (!_lgGenerated) return;

  const firstname = document.getElementById('lg-firstname')?.value || '';
  const retreat   = document.getElementById('lg-retreat')?.value   || '';
  const rawPhone  = document.getElementById('lg-phone')?.value     || '';
  const phone     = rawPhone.replace(/[\s\-\(\)\+]/g, '').replace(/^00/, '');
  const msgEl     = document.getElementById('lg-message');
  const linksEl   = document.getElementById('lg-links');

  const msg = lgBuildMessage(firstname, retreat);
  if (msgEl) msgEl.textContent = msg;

  const encoded = encodeURIComponent(msg);
  const href    = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  const sub     = phone
    ? `To +${rawPhone.trim().replace(/^\+/, '')}`
    : 'No number — select recipient in WhatsApp';

  if (linksEl) {
    linksEl.innerHTML = `
      <a href="${href}" target="_blank" rel="noopener"
        style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;text-decoration:none;-webkit-tap-highlight-color:transparent;">
        <div style="width:40px;height:40px;border-radius:50%;background:#E8F5E9;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">💬</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--dark);margin-bottom:2px;">Message 1 — Curiosity Hook</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>
        </div>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`;
  }
}
