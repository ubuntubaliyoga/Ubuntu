// ── SUPABASE AUTH ─────────────────────────────────────────────────────────────
// Fill in your Supabase project URL and anon key (safe to expose client-side)
const SUPABASE_URL     = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ALLOWED_EMAIL    = 'ubuntubali@gmail.com';

const { createClient } = supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function _handleAuth(session) {
  if (session?.user?.email === ALLOWED_EMAIL) {
    _hideGate();
  } else {
    if (session) {
      _sb.auth.signOut();
      _setGateError('Access is restricted to the Ubuntu Bali team.');
    }
    // Gate stays visible — no authenticated session
  }
}

function _hideGate() {
  const gate = document.getElementById('login-gate');
  if (!gate || gate.classList.contains('exit')) return;
  gate.classList.add('exit');
  gate.addEventListener('animationend', () => { gate.style.display = 'none'; }, { once: true });
}

function _setGateError(msg) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = msg || '';
}

async function loginWithGoogle() {
  const btn = document.getElementById('login-google-btn');
  const txt = btn?.querySelector('.login-btn-text');
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Redirecting…'; }

  const { error } = await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });

  if (error) {
    _setGateError(error.message);
    if (btn) { btn.disabled = false; if (txt) txt.textContent = 'Continue with Google'; }
  }
}

async function signOut() {
  await _sb.auth.signOut();
  const gate = document.getElementById('login-gate');
  if (gate) { gate.style.display = 'flex'; gate.classList.remove('exit'); }
  _setGateError('');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
(async () => {
  // Check existing session first (fast — reads from localStorage)
  const { data: { session } } = await _sb.auth.getSession();
  _handleAuth(session);

  // Keep watching for OAuth redirects and manual sign-outs
  _sb.auth.onAuthStateChange((_event, session) => { _handleAuth(session); });
})();
