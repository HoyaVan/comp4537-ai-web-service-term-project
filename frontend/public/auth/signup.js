const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const SIGNUP_PATH = '/api/auth/signup';

async function submitSignup(payload) {
  const res = await fetch(BACKEND_URL + SIGNUP_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    mode: 'cors',
    credentials: 'omit',
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim(),
      password: payload.password
    })
  });
  const isJSON = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJSON ? await res.json() : await res.text();
  return { ok: res.ok, data };
}

function initSignup() {
  // Initialize header first (if headerUtils is loaded)
  if (typeof initLoggedOutHeader === 'function') {
    try {
      initLoggedOutHeader();
    } catch (err) {
      console.warn('Failed to initialize header:', err);
    }
  }

  const form = document.getElementById('signup-form');
  const backend = document.getElementById('backend-url');
  const msg = document.getElementById('message');
  const btn = document.getElementById('submit-btn');

  if (!form) {
    console.error('Signup form not found');
    return; // Exit if form not found
  }
  
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
    const name = document.getElementById('name').value || '';
    const email = document.getElementById('email').value || '';
    const password = document.getElementById('password').value || '';
    const confirm = document.getElementById('confirm').value || '';

    if (!name.trim()) return setMessage('Name is required.');
    if (!email.trim()) return setMessage('Email is required.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMessage('Enter a valid email.');
    if (!password) return setMessage('Password is required.');
    if (password.length < 6) return setMessage('Password must be at least 6 characters.');
    if (password !== confirm) return setMessage('Passwords do not match.');

    btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      const { ok, data } = await submitSignup({ name, email, password });
      if (!ok) {
        const message = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
        setMessage('Signup failed: ' + message, false);
      } else {
        const message = typeof data === 'string' ? data : (data.message || 'Account created.');
        setMessage('Success: ' + message, true);
        form.reset();
      }
    } catch (err) {
      setMessage('Network error: ' + err, false);
    } finally {
      btn.disabled = false; btn.textContent = 'Sign up';
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignup);
} else {
  initSignup();
}

