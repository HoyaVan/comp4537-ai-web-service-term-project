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
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!window.authService) {
      console.error('authService not available');
      window.location.replace(redirectPath);
      return false;
    }
  }

  // Check if token exists
  const token = window.authService.getToken();
  if (!token) {
    console.log('No token found, redirecting to login');
    window.location.replace(redirectPath);
    return false;
  }

  // Verify authentication with backend
  const auth = await isAuthenticated();
  if (!auth) {
    console.log('Not authenticated, redirecting to login');
    window.location.replace(redirectPath);
    return false;
  }

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

