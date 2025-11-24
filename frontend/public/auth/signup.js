import { authMessages } from '/messages/auth.js';

const SIGNUP_PATH = '/api/auth/signup';

async function submitSignup(payload) {
  const res = await fetch(window.getBackendUrl() + SIGNUP_PATH, {
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

async function initSignup() {
  // Initialize header first (if headerUtils is loaded)
  if (typeof initLoggedOutHeader === 'function') {
    try {
      await initLoggedOutHeader();
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
    const name = document.getElementById('name').value || '';
    const email = document.getElementById('email').value || '';
    const password = document.getElementById('password').value || '';
    const confirm = document.getElementById('confirm').value || '';

    if (!name.trim()) return setMessage(authMessages.firstNameRequired);
    if (!email.trim()) return setMessage(authMessages.emailRequired);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMessage(authMessages.emailInvalid);
    if (!password) return setMessage(authMessages.passwordRequired);
    if (password.length < 6) return setMessage(authMessages.passwordMinLength);
    if (password !== confirm) return setMessage(authMessages.passwordsNotMatch);

    btn.disabled = true; btn.textContent = authMessages.signingUp;
    try {
      const { ok, data } = await submitSignup({ name, email, password });
      if (!ok) {
        const message = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
        setMessage(authMessages.signupFailed + message, false);
      } else {
        const message = typeof data === 'string' ? data : (data.message || authMessages.accountCreated);
        setMessage(authMessages.successPrefix + message, true);
        form.reset();
        
        // After successful signup, automatically log in the user and redirect to dashboard
        // Backend returns { success: true, data: { user: {...}, token: "..." } }
        const token = data?.data?.token || data?.token;
        if (token) {
          try {
            localStorage.setItem('token', token);
            // Redirect to dashboard after successful signup
            setTimeout(() => {
              window.location.href = '/dashboard.html';
            }, 1000);
          } catch (err) {
            console.warn('Failed to store token:', err);
            // If token storage fails, redirect anyway (user can login manually if needed)
            setTimeout(() => {
              window.location.href = '/dashboard.html';
            }, 1500);
          }
        } else {
          // If no token in response, try auto-login with the credentials
          try {
            const loginRes = await fetch(window.getBackendUrl() + '/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              mode: 'cors',
              credentials: 'omit',
              body: JSON.stringify({
                email: email.trim(),
                password: password
              })
            });
            const loginData = await loginRes.json();
            if (loginRes.ok && loginData.data?.token) {
              localStorage.setItem('token', loginData.data.token);
              setTimeout(() => {
                window.location.href = '/dashboard.html';
              }, 500);
            } else {
              // If auto-login fails, redirect to login page
              setTimeout(() => {
                window.location.href = '/login.html?signup=success';
              }, 1500);
            }
          } catch (loginErr) {
            console.warn('Auto-login after signup failed:', loginErr);
            // Redirect to login page
            setTimeout(() => {
              window.location.href = '/login.html?signup=success';
            }, 1500);
          }
        }
      }
    } catch (err) {
      setMessage(authMessages.networkError + err, false);
    } finally {
      btn.disabled = false; btn.textContent = authMessages.signUp;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignup);
} else {
  initSignup();
}

