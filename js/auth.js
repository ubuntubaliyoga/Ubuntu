// ── SUPABASE AUTH ─────────────────────────────────────────────────────────────
// Fill in your Supabase project URL and anon key (safe to expose client-side)
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ALLOWED_EMAIL     = 'ubuntubali@gmail.com';

const _configured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const _sb = _configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function _handleAuth(session) {
  if (session?.user?.email === ALLOWED_EMAIL) {
    _hideGate();
  } else {
    if (session) {
      _sb.auth.signOut();
      _setGateError('Access is restricted to the Ubuntu Bali team.');
    }
  }
}

function _hideGate() {
  const gate = document.getElementById('login-gate');
  if (!gate || gate.classList.contains('exit')) return;
  gate.classList.add('exit');
  gate.addEventListener('animationend', () => { gate.style.display = 'none'; }, { once: true });
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

  // Safety net: reset button if redirect never happens (e.g. popup blocked, network error)
  const resetTimer = setTimeout(_resetBtn, 10000);

  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      clearTimeout(resetTimer);
      _setGateError(error.message);
      _resetBtn();
    }
    // On success Supabase navigates away — resetTimer cleans up if it doesn't
  } catch (e) {
    clearTimeout(resetTimer);
    _setGateError(e.message || 'Login failed. Check your Supabase configuration.');
    _resetBtn();
  }
}

async function signOut() {
  if (_sb) await _sb.auth.signOut();
  const gate = document.getElementById('login-gate');
  if (gate) { gate.style.display = 'flex'; gate.classList.remove('exit'); }
  _setGateError('');
}

// ── INIT ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!_configured) return; // Gate stays visible until credentials are added

  try {
    // Register BEFORE getSession — OAuth callback fires onAuthStateChange
    // immediately on client creation; registering late means missing the event
    _sb.auth.onAuthStateChange((_event, session) => { _handleAuth(session); });

    const { data: { session } } = await _sb.auth.getSession();
    _handleAuth(session);
  } catch (e) {
    _setGateError('Auth error: ' + (e.message || 'check Supabase config'));
  }
})();
