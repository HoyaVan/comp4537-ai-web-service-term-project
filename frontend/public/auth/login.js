import { authMessages } from '/messages/auth.js';

const LOGIN_PATH = '/api/v1/auth/login';

async function submitLogin(payload) {
  const res = await fetch(window.getBackendUrl() + LOGIN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    mode: 'cors',
    credentials: 'omit',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password
    })
  });
  
  // Clone response to read body multiple times if needed
  const clonedRes = res.clone();
  
  // Check content-type and handle response appropriately
  const contentType = res.headers.get('content-type') || '';
  const isJSON = contentType.includes('application/json');
  
  let data;
  if (isJSON) {
    try {
      data = await res.json();
    } catch (jsonError) {
      // If JSON parsing fails, get text from cloned response
      const text = await clonedRes.text();
      return { 
        ok: false, 
        data: { 
          message: `Server returned invalid JSON. Status: ${res.status}. Response: ${text.substring(0, 200)}` 
        } 
      };
    }
  } else {
    // Not JSON - get as text
    const text = await res.text();
    return { 
      ok: false, 
      data: { 
        message: `Server returned ${contentType || 'non-JSON'} response. Status: ${res.status}. Response: ${text.substring(0, 200)}` 
      } 
    };
  }
  
  return { ok: res.ok, data };
}

async function initLogin() {
  // Clear logout flag if present (logout completed successfully)
  if (sessionStorage.getItem('__isLoggingOut') === 'true') {
    sessionStorage.removeItem('__isLoggingOut');
    window.__isLoggingOut = false;
  }
  
  // Initialize header first (if headerUtils is loaded)
  if (typeof initLoggedOutHeader === 'function') {
    try {
      await initLoggedOutHeader();
    } catch (err) {
      console.warn('Failed to initialize header:', err);
    }
  }

  const form = document.getElementById('login-form');
  const backend = document.getElementById('backend-url');
  const msg = document.getElementById('message');
  const btn = document.getElementById('submit-btn');

  if (!form) {
    console.error('Login form not found');
    return; // Exit if form not found
  }
  
  if (backend) backend.textContent = window.getBackendUrl();

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

    if (!email.trim()) return setMessage(authMessages.emailRequired);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMessage(authMessages.emailInvalid);
    if (!password) return setMessage(authMessages.passwordRequired);

    btn.disabled = true; btn.textContent = authMessages.loggingIn;
    try {
      const { ok, data } = await submitLogin({ email, password });
      if (!ok) {
        const message = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
        setMessage(authMessages.loginFailed + message, false);
      } else {
        const message = typeof data === 'string' ? data : (data.message || authMessages.loggedIn);
        setMessage(authMessages.successPrefix + message, true);
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
      setMessage(authMessages.networkError + err, false);
    } finally {
      btn.disabled = false; btn.textContent = authMessages.login;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogin);
} else {
  initLogin();
}

