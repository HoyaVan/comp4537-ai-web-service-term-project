const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const LOGIN_PATH = '/api/auth/login';

async function submitLogin(payload) {
  const res = await fetch(BACKEND_URL + LOGIN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    mode: 'cors',
    credentials: 'omit',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password
    })
  });
  const isJSON = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJSON ? await res.json() : await res.text();
  return { ok: res.ok, data };
}

function initLogin() {
  const form = document.getElementById('login-form');
  const backend = document.getElementById('backend-url');
  const msg = document.getElementById('message');
  const btn = document.getElementById('submit-btn');

  if (!form) return; // Exit if form not found
  
  if (backend) backend.textContent = BACKEND_URL;

  function setMessage(text, ok = false) {
    if (msg) {
      msg.textContent = text;
      msg.className = 'msg ' + (ok ? 'ok' : 'err');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');
    const email = document.getElementById('email').value || '';
    const password = document.getElementById('password').value || '';

    if (!email.trim()) return setMessage('Email is required.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMessage('Enter a valid email.');
    if (!password) return setMessage('Password is required.');

    btn.disabled = true; btn.textContent = 'Logging in...';
    try {
      const { ok, data } = await submitLogin({ email, password });
      if (!ok) {
        const message = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
        setMessage('Login failed: ' + message, false);
      } else {
        const message = typeof data === 'string' ? data : (data.message || 'Logged in.');
        setMessage('Success: ' + message, true);
        // Backend returns { success: true, data: { user: {...}, token: "..." } }
        const token = data?.data?.token || data?.token;
        if (token) { 
          try { 
            localStorage.setItem('token', token); 
            // Redirect to dashboard after successful login
            setTimeout(() => {
              window.location.href = '/dashboard.html';
            }, 1000);
          } catch (_) {} 
        }
      }
    } catch (err) {
      setMessage('Network error: ' + err, false);
    } finally {
      btn.disabled = false; btn.textContent = 'Login';
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogin);
} else {
  initLogin();
}

