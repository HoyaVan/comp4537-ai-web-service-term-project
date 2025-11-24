/**
 * Authentication guard utilities for protected pages
 */

/**
 * Check if user is authenticated using authService
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
  if (window.authService) {
    return await window.authService.isAuthenticated();
  }
  return false;
}

/**
 * Require authentication - redirects to login if not authenticated
 * @param {string} redirectPath - Path to redirect to if not authenticated (default: '/login')
 * @returns {Promise<boolean>} Whether user is authenticated
 */
export async function requireAuth(redirectPath = '/login') {
  // Wait for authService to be available
  if (!window.authService) {
    console.log('[authGuard] Waiting for authService...');
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!window.authService) {
      console.error('[authGuard] authService not available after waiting');
      window.location.replace(redirectPath);
      return false;
    }
  }

  // Check if token exists
  const token = window.authService.getToken();
  console.log('[authGuard] Token check:', token ? 'Token found' : 'No token');
  if (!token) {
    console.log('[authGuard] No token found, redirecting to login');
    window.location.replace(redirectPath);
    return false;
  }

  // Verify authentication with backend
  console.log('[authGuard] Verifying authentication with backend...');
  const auth = await isAuthenticated();
  if (!auth) {
    console.log('[authGuard] Not authenticated, redirecting to login');
    window.location.replace(redirectPath);
    return false;
  }

  console.log('[authGuard] Authentication successful');
  return true;
}

/**
 * Get current user from authService
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
  if (window.authService) {
    return window.authService.getCurrentUser();
  }
  return null;
}

/**
 * Check if current user has admin role
 * @returns {Promise<boolean>} Whether user is admin
 */
export async function requireAdmin(redirectPath = '/dashboard') {
  const isAuth = await requireAuth();
  if (!isAuth) {
    return false;
  }

  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    window.location.replace(redirectPath);
    return false;
  }

  return true;
}

