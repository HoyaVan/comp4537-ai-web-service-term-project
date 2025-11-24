/**
 * Shared utilities for authentication pages
 */

/**
 * Display a message to the user
 * @param {HTMLElement} msgElement - The message element
 * @param {string} text - Message text
 * @param {boolean} isSuccess - Whether it's a success message
 */
export function setMessage(msgElement, text, isSuccess = false) {
  if (msgElement) {
    msgElement.textContent = text;
    msgElement.className = 'msg ' + (isSuccess ? 'ok' : 'err');
  }
}

/**
 * Update backend URL display
 * @param {HTMLElement} backendElement - The backend URL element
 */
export function updateBackendUrl(backendElement) {
  if (backendElement && window.getBackendUrl) {
    backendElement.textContent = window.getBackendUrl();
  }
}

/**
 * Store token and update authService
 * @param {string} token - JWT token
 * @param {Object} user - User object (optional)
 * @returns {boolean} Success status
 */
export function storeToken(token, user = null) {
  try {
    localStorage.setItem('token', token);
    if (window.authService) {
      window.authService.setToken(token);
      if (user) {
        window.authService.currentUser = user;
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to store token:', err);
    return false;
  }
}

/**
 * Handle successful authentication - store token and redirect
 * @param {Object} data - Response data from backend
 * @param {string} redirectPath - Path to redirect to (default: '/dashboard')
 * @param {number} delay - Delay in ms before redirect (default: 500)
 * @returns {boolean} Success status
 */
export function handleAuthSuccess(data, redirectPath = '/dashboard', delay = 500) {
  const token = data?.data?.token || data?.token;
  if (!token) {
    console.error('No token in response:', data);
    return false;
  }

  const user = data?.data?.user || null;
  if (storeToken(token, user)) {
    setTimeout(() => {
      window.location.href = redirectPath;
    }, delay);
    return true;
  }
  return false;
}

/**
 * Initialize logged-out header
 */
export async function initLoggedOutHeader() {
  if (typeof window.initLoggedOutHeader === 'function') {
    try {
      await window.initLoggedOutHeader();
    } catch (err) {
      console.warn('Failed to initialize header:', err);
    }
  }
}

/**
 * Clear logout flag if present
 */
export function clearLogoutFlag() {
  if (sessionStorage.getItem('__isLoggingOut') === 'true') {
    sessionStorage.removeItem('__isLoggingOut');
    window.__isLoggingOut = false;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
export function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Wait for authService to be available
 * @param {number} maxWait - Maximum wait time in ms (default: 2000)
 * @returns {Promise<boolean>} Whether authService is available
 */
export async function waitForAuthService(maxWait = 2000) {
  if (window.authService) {
    return true;
  }
  
  const checkInterval = 50;
  const maxChecks = maxWait / checkInterval;
  
  for (let i = 0; i < maxChecks; i++) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    if (window.authService) {
      return true;
    }
  }
  
  return false;
}

