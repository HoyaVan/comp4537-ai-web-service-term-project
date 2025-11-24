import { authMessages } from '/messages/auth.js';
import { setMessage, updateBackendUrl, handleAuthSuccess, initLoggedOutHeader, clearLogoutFlag, validateEmail } from './utils.js';

/**
 * Initialize login page
 */
async function initLogin() {
  // Clear logout flag if present
  clearLogoutFlag();
  
  // Initialize header
  await initLoggedOutHeader();

  const form = document.getElementById('login-form');
  const backend = document.getElementById('backend-url');
  const msg = document.getElementById('message');
  const btn = document.getElementById('submit-btn');

  if (!form) {
    console.error('Login form not found');
    return;
  }
  
  // Update backend URL display
  updateBackendUrl(backend);

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(msg, '');
    
    const email = document.getElementById('email').value || '';
    const password = document.getElementById('password').value || '';

    // Validate inputs
    if (!email.trim()) {
      return setMessage(msg, authMessages.emailRequired, false);
    }
    if (!validateEmail(email)) {
      return setMessage(msg, authMessages.emailInvalid, false);
    }
    if (!password) {
      return setMessage(msg, authMessages.passwordRequired, false);
    }

    // Disable button and show loading state
    btn.disabled = true;
    btn.textContent = authMessages.loggingIn;
    
    try {
      // Use authService for login
      if (!window.authService) {
        throw new Error('Authentication service not available');
      }

      const result = await window.authService.login(email, password);
      
      if (result.success) {
        setMessage(msg, authMessages.successPrefix + result.message, true);
        
        // Verify token was stored
        const token = window.authService.getToken();
        console.log('[login] Token after login:', token ? 'Token stored' : 'No token');
        if (!token) {
          console.error('[login] Token not stored after login');
          setMessage(msg, 'Login successful but token not saved. Please try again.', false);
          btn.disabled = false;
          btn.textContent = authMessages.login;
          return;
        }
        
        // Double-check token is in localStorage
        const localStorageToken = localStorage.getItem('token');
        console.log('[login] Token in localStorage:', localStorageToken ? 'Found' : 'Not found');
        if (!localStorageToken) {
          console.error('[login] Token not in localStorage, storing now...');
          window.authService.setToken(token);
        }
        
        // Redirect to dashboard
        console.log('[login] Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        setMessage(msg, authMessages.loginFailed + result.message, false);
        btn.disabled = false;
        btn.textContent = authMessages.login;
      }
    } catch (err) {
      setMessage(msg, authMessages.networkError + (err.message || err), false);
      btn.disabled = false;
      btn.textContent = authMessages.login;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogin);
} else {
  initLogin();
}
