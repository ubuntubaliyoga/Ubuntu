// ── SUPABASE AUTH ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ALLOWED_EMAIL     = 'ubuntubaliyoga@gmail.com';

const _configured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const _sb = _configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
}) : null;

let _gateDismissed = false;

function _handleAuth(session) {
  if (!session) return;
  const email = (session.user?.email || '').toLowerCase();
  if (email === ALLOWED_EMAIL.toLowerCase()) {
    _hideGate();
  } else {
    _sb.auth.signOut();
    _setGateError(`Access denied: signed in as ${session.user.email}`);
  }
}

function _hideGate() {
  if (_gateDismissed) return;
  _gateDismissed = true;
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.classList.add('exit');
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
  if (!_configured) { _setGateError('Supabase not configured.'); return; }
  const btn = document.getElementById('login-google-btn');
  const txt = btn?.querySelector('.login-btn-text');
  if (btn) { btn.disabled = true; if (txt) txt.textContent = 'Redirecting…'; }
  const t = setTimeout(_resetBtn, 10000);
  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) { clearTimeout(t); _setGateError(error.message); _resetBtn(); }
  } catch (e) { clearTimeout(t); _setGateError(e.message || 'Login failed.'); _resetBtn(); }
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
    // 1. Watch for future sign-ins (e.g. token refresh)
    _sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') _handleAuth(session);
    });

    // 2. Check for an existing session or complete a PKCE code exchange.
    //    With flowType:'pkce' + detectSessionInUrl:true, Supabase automatically
    //    handles the ?code= parameter on redirect back from Google.
    const { data: { session } } = await _sb.auth.getSession();
    if (session) { _handleAuth(session); return; }

  } catch (e) {
    _setGateError('Auth error: ' + (e.message || 'check Supabase config'));
  }
})();
