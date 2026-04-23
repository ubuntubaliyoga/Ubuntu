// js/bizdev.js — Leadgen tab

const LG_CITIES = [
  'Amsterdam', 'London', 'Berlin', 'New York', 'Los Angeles', 'Sydney',
  'Melbourne', 'Toronto', 'Zurich', 'Vienna', 'Barcelona', 'Lisbon',
  'Paris', 'Stockholm', 'Copenhagen', 'Vancouver', 'San Francisco',
  'Tulum', 'Ibiza', 'Cape Town', 'Singapore', 'Dubai', 'Tel Aviv',
  'Milan', 'Prague', 'Budapest', 'Athens', 'Oslo', 'Helsinki', 'Auckland',
  'Bali', 'Chiang Mai', 'Playa del Carmen', 'Nosara', 'Sedona',
];

let _lgRunning = false;

function lgRandomCity() {
  const el = document.getElementById('lg-city');
  if (el) el.value = LG_CITIES[Math.floor(Math.random() * LG_CITIES.length)];
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
    const added   = (data.leads || []).filter(l => l.status === 'added').length;
    const skipped = (data.leads || []).filter(l => l.status === 'skipped').length;
    lgStatus(`✅ ${added} leads added to Notion${skipped ? ` · ${skipped} skipped (duplicate)` : ''} — ${city}`, 'ok');
    lgRenderLeads(data.leads || []);
  } catch (e) {
    lgStatus('Error: ' + e.message, 'error');
  } finally {
    _lgRunning = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Leads'; }
  }
}

function lgStatus(msg, type) {
  const el = document.getElementById('lg-status');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'lg-status lg-s-' + (type || 'info');
  el.style.display = msg ? 'block' : 'none';
}

function lgRenderLeads(leads) {
  const el = document.getElementById('lg-results');
  if (!el) return;
  if (!leads.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No leads found. Try a different city.</div>';
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
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;font-size:12px;color:var(--muted);">
        ${lead.phone   ? `<span>📞 ${esc(lead.phone)}</span>` : '<span style="opacity:.5;">📞 no number</span>'}
        ${lead.email   ? `<span>✉️ ${esc(lead.email)}</span>`  : ''}
        ${lead.website ? `<a href="${esc(lead.website)}" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">🌐 website</a>` : ''}
      </div>
      ${lead.waLink
        ? `<a href="${esc(lead.waLink)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px;background:#E8F5E9;border:1px solid #C8E6C9;border-radius:var(--radius-sm);color:#2E7D32;font-size:13px;font-weight:600;text-decoration:none;">💬 Open in WhatsApp</a>`
        : `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;font-style:italic;">No phone number — message not available</div>`
      }
    </div>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
