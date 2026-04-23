// js/bizdev.js

const LG_CITIES = [
  'Amsterdam', 'London', 'Berlin', 'New York', 'Los Angeles', 'Sydney',
  'Melbourne', 'Toronto', 'Zurich', 'Vienna', 'Barcelona', 'Lisbon',
  'Paris', 'Stockholm', 'Copenhagen', 'Vancouver', 'San Francisco',
  'Tulum', 'Ibiza', 'Cape Town', 'Singapore', 'Dubai', 'Tel Aviv',
  'Milan', 'Prague', 'Budapest', 'Athens', 'Oslo', 'Helsinki', 'Auckland',
  'Bali', 'Chiang Mai', 'Playa del Carmen', 'Nosara', 'Sedona'
];

function lgRandomCity() {
  const city = LG_CITIES[Math.floor(Math.random() * LG_CITIES.length)];
  const el = document.getElementById('lg-city');
  if (el) { el.value = city; lgUpdate(); }
}

function lgBuildMessage(city) {
  return `Hey! 👋 I came across your work online and think you'd be a wonderful fit for Ubuntu Bali.

We're a boutique yoga & wellness retreat venue in the heart of Ubud, hosting retreat leaders from ${city} and all over the world 🌿

We take care of everything: a stunning shala, cozy accommodation, 2 plant-based meals per day, and full logistics support — so you can focus entirely on what you love: teaching.

Would you be open to a quick chat to explore it? 🙏✨

Warm greetings,
Ubuntu Bali`;
}

function lgCopyMessage() {
  const city = (document.getElementById('lg-city')?.value || '').trim();
  if (!city) { alert('Enter a city first.'); return; }
  const msg = lgBuildMessage(city);
  const btn = document.getElementById('lg-copy-btn');
  const reset = () => { if (btn) btn.textContent = 'Copy'; };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(msg).then(() => {
      if (btn) { btn.textContent = 'Copied ✓'; setTimeout(reset, 2000); }
    }).catch(() => _lgCopyFallback(msg, btn, reset));
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
  const city = (document.getElementById('lg-city')?.value || '').trim();
  const msgEl  = document.getElementById('lg-message');
  const linksEl = document.getElementById('lg-links');

  if (!city) {
    if (msgEl)   msgEl.innerHTML  = '<span style="color:var(--muted);font-style:italic;">Enter a city above to generate the outreach message.</span>';
    if (linksEl) linksEl.innerHTML = '<div style="color:var(--muted);font-size:13px;font-style:italic;text-align:center;padding:20px 0;">Enter a city to generate WhatsApp links.</div>';
    return;
  }

  const msg = lgBuildMessage(city);
  if (msgEl) msgEl.textContent = msg;

  if (linksEl) {
    const enc = encodeURIComponent(msg);
    const linkCard = (icon, bg, title, sub, href) => `
      <a href="${href}" target="_blank" rel="noopener"
        style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;text-decoration:none;margin-bottom:10px;-webkit-tap-highlight-color:transparent;">
        <div style="width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--dark);margin-bottom:2px;">${title}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>
        </div>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`;

    linksEl.innerHTML =
      linkCard('💬', '#E8F5E9', 'Open in WhatsApp', `Message pre-filled · ${city}`, `https://wa.me/?text=${enc}`) +
      linkCard('🖥️', '#E3F2FD', 'WhatsApp Web', `Open in browser · ${city}`, `https://web.whatsapp.com/send?text=${enc}`);
  }
}
