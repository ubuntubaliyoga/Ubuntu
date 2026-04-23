// js/fx.js — dopamine visual effects

// ── CONFETTI BURST ────────────────────────────────────────────────────────────
// Colorful confetti exploding from an element (e.g. FAB button).
function fxConfetti(originEl) {
  if (!originEl) return;
  const r  = originEl.getBoundingClientRect();
  const cx = r.left + r.width  / 2;
  const cy = r.top  + r.height / 2;

  const canvas = document.createElement('canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const COLS = [
    '#B8935A','#FFD700','#FF6B6B','#4ECDC4',
    '#45B7D1','#96CEB4','#FFEAA7','#C9A8DC','#FF9A8B','#A8E6CF',
  ];

  const pts = Array.from({ length: 55 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 10;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,   // slight upward bias
      w:  5 + Math.random() * 7,
      h:  3 + Math.random() * 5,
      col: COLS[i % COLS.length],
      rot: Math.random() * 360,
      rv:  (Math.random() - .5) * 15,
    };
  });

  let t0   = null;
  const DUR = 1800;

  (function frame(ts) {
    if (!t0) t0 = ts;
    const prog = (ts - t0) / DUR;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let live = false;

    pts.forEach(p => {
      const alpha = Math.max(0, 1 - prog * 1.1);
      if (!alpha) return;
      live = true;

      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.28;   // gravity
      p.vx *= 0.99;   // light air resistance
      p.rot += p.rv;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (live) requestAnimationFrame(frame);
    else canvas.remove();
  })(performance.now());
}

// ── FLOATING TEXT BURST ───────────────────────────────────────────────────────
// Words/emojis float upward and fade out from an element.
function fxTextBurst(originEl, words) {
  if (!originEl) return;
  const r  = originEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top;

  words.forEach((word, i) => {
    const span  = document.createElement('span');
    span.textContent = word;

    const ox    = (Math.random() - .5) * Math.max(r.width * 1.4, 70);
    const rise  = 60 + Math.random() * 60;
    const drift = (Math.random() - .5) * 40;
    const sz    = 12 + Math.random() * 9;

    span.style.cssText = `
      position:fixed;
      left:${cx + ox}px;
      top:${cy}px;
      transform:translate(-50%,-50%) scale(.5);
      font-family:'Inter',sans-serif;
      font-size:${sz}px;
      font-weight:800;
      color:var(--gold);
      pointer-events:none;
      z-index:9999;
      opacity:0;
      white-space:nowrap;
      will-change:transform,opacity;
    `;
    document.body.appendChild(span);

    // Pop in + rise
    setTimeout(() => {
      span.style.transition = `transform .72s cubic-bezier(.17,.84,.44,1), opacity .45s ease`;
      span.style.transform  = `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(1)`;
      span.style.opacity    = '1';
    }, 20 + i * 70);

    // Fade out
    setTimeout(() => {
      span.style.transition = 'opacity .32s ease';
      span.style.opacity    = '0';
    }, 20 + i * 70 + 530);

    setTimeout(() => span.remove(), 20 + i * 70 + 900);
  });
}

// ── SPARKLE BURST ─────────────────────────────────────────────────────────────
// Gold star/emoji shower — used when a lead moves to Warm.
function fxSparkle(originEl) {
  fxTextBurst(originEl, ['🌟', '⭐', '✨', '💛', '🌟', '✨']);
}

// ── SINGLE POP ────────────────────────────────────────────────────────────────
// A single word pops upward from an element — used for quick confirmations.
function fxPop(originEl, text, color) {
  if (!originEl) return;
  const r    = originEl.getBoundingClientRect();
  const span = document.createElement('span');
  span.textContent = text;
  span.style.cssText = `
    position:fixed;
    left:${r.left + r.width / 2}px;
    top:${r.top}px;
    transform:translate(-50%,-130%) scale(.4);
    font-family:'Inter',sans-serif;
    font-size:14px;
    font-weight:800;
    color:${color || 'var(--gold)'};
    pointer-events:none;
    z-index:9999;
    opacity:0;
    white-space:nowrap;
  `;
  document.body.appendChild(span);

  setTimeout(() => {
    span.style.transition = 'transform .5s cubic-bezier(.17,.84,.44,1), opacity .4s ease';
    span.style.transform  = 'translate(-50%, calc(-130% - 30px)) scale(1)';
    span.style.opacity    = '1';
  }, 20);

  setTimeout(() => {
    span.style.transition = 'opacity .3s ease';
    span.style.opacity    = '0';
  }, 680);

  setTimeout(() => span.remove(), 1020);
}
