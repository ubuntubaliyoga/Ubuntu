// ── SUPABASE AUTH ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ALLOWED_EMAIL     = 'ubuntubaliyoga@gmail.com';

const _configured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

// implicit flow: tokens arrive in URL hash — no PKCE code exchange,
// no localStorage code_verifier needed, no silent failure on redirect
const _sb = _configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true }
}) : null;

let _gateDismissed = false;

function _handleAuth(session) {
  if (!session) return; // no session — gate stays, nothing to do
  const email = (session.user?.email || '').toLowerCase();
  if (email === ALLOWED_EMAIL.toLowerCase()) {
    _hideGate();
  } else {
    _sb.auth.signOut();
    _setGateError(`Access denied (${session.user.email}). Only the Ubuntu Bali account can log in.`);
  }
}

function _hideGate() {
  if (_gateDismissed) return;
  _gateDismissed = true;
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.classList.add('exit');
  // setTimeout is reliable; animationend can silently not fire
  setTimeout(() => { gate.style.display = 'none'; }, 800);
}

function _resetBtn() {
  const btn = document.getElementById('login-google-btn');
  const txt = btn?.querySelector('.login-btn-text');
  if (btn) { btn.disabled = false; if (txt) txt.textContent = 'Continue with Google'; }
}

function _setGateError(msg) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = msg || '';
}

async function loginWithGoogle() {
  if (!_configured) {
    _setGateError('Supabase is not configured yet — add credentials to js/auth.js');
    return;
  }
  const btn = document.getElementById('login-google-btn');
  const txt = btn?.querySelector('.login-btn-text');
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Redirecting…'; }
  const resetTimer = setTimeout(_resetBtn, 10000);
  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) { clearTimeout(resetTimer); _setGateError(error.message); _resetBtn(); }
  } catch (e) {
    clearTimeout(resetTimer);
    _setGateError(e.message || 'Login failed. Check Supabase configuration.');
    _resetBtn();
  }
}

async function signOut() {
  _gateDismissed = false;
  if (_sb) await _sb.auth.signOut();
  const gate = document.getElementById('login-gate');
  if (gate) { gate.style.display = 'flex'; gate.classList.remove('exit'); }
  _setGateError('');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!_configured) return;
  try {
    // Register first — catches SIGNED_IN fired during client init (implicit flow)
    _sb.auth.onAuthStateChange((event, session) => {
      // Only act on actual sign-in events; ignore SIGNED_OUT (triggered by our own signOut calls)
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        _handleAuth(session);
      }
    });
    // Also check existing session (returning visitor with valid stored session)
    const { data: { session } } = await _sb.auth.getSession();
    _handleAuth(session);
  } catch (e) {
    _setGateError('Auth error: ' + (e.message || 'check Supabase config'));
  }
})();
