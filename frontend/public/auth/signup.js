import { authMessages } from '/messages/auth.js';
import { setMessage, updateBackendUrl, handleAuthSuccess, initLoggedOutHeader, clearLogoutFlag, validateEmail } from './utils.js';

/**
 * Initialize signup page
 */
async function initSignup() {
  // Clear logout flag if present
  clearLogoutFlag();
  
  // Initialize header
  await initLoggedOutHeader();

  const form = document.getElementById('signup-form');
  const backend = document.getElementById('backend-url');
  const msg = document.getElementById('message');
  const btn = document.getElementById('submit-btn');

  if (!form) {
    console.error('Signup form not found');
    return;
  }
  
  // Update backend URL display
  updateBackendUrl(backend);

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(msg, '');
    
    const name = document.getElementById('name').value || '';
    const email = document.getElementById('email').value || '';
    const password = document.getElementById('password').value || '';
    const confirm = document.getElementById('confirm').value || '';

    // Validate inputs
    if (!name.trim()) {
      return setMessage(msg, authMessages.firstNameRequired, false);
    }
    if (!email.trim()) {
      return setMessage(msg, authMessages.emailRequired, false);
    }
    if (!validateEmail(email)) {
      return setMessage(msg, authMessages.emailInvalid, false);
    }
    if (!password) {
      return setMessage(msg, authMessages.passwordRequired, false);
    }
    if (password.length < 6) {
      return setMessage(msg, authMessages.passwordMinLength, false);
    }
    if (password !== confirm) {
      return setMessage(msg, authMessages.passwordsNotMatch, false);
    }

    // Disable button and show loading state
    btn.disabled = true;
    btn.textContent = authMessages.signingUp;
    
    try {
      // Use authService for signup
      if (!window.authService) {
        throw new Error('Authentication service not available');
      }

      const result = await window.authService.signup(name, email, password);
      
      if (result.success) {
        setMessage(msg, authMessages.successPrefix + result.message, true);
        form.reset();
        
        // Token is already stored by authService.signup()
        // Verify token and redirect
        const token = window.authService.getToken();
        if (token) {
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 500);
        } else {
          setMessage(msg, 'Account created but failed to save session. Please login manually.', false);
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } else {
        setMessage(msg, authMessages.signupFailed + result.message, false);
        btn.disabled = false;
        btn.textContent = authMessages.signUp;
      }
    } catch (err) {
      setMessage(msg, authMessages.networkError + (err.message || err), false);
      btn.disabled = false;
      btn.textContent = authMessages.signUp;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignup);
} else {
  initSignup();
}
