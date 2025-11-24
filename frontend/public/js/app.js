/**
 * Minimal client-side code
 * Most logic is handled server-side in server.js
 */

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize page-specific functionality if needed
  const path = window.location.pathname;
  
  // Minimal initialization - most logic is server-side
  if (typeof initPage === 'function') {
    initPage();
  }
});

/**
 * Intercept navigation clicks to ensure route-based navigation
 */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link || !link.href) return;
  
  try {
    const url = new URL(link.href);
    // Only handle same-origin links
    if (url.origin !== window.location.origin) return;
    
    // Convert .html links to routes
    if (url.pathname.endsWith('.html')) {
      e.preventDefault();
      const route = url.pathname.replace('.html', '') || '/';
      window.location.href = route;
    }
  } catch (err) {
    // Invalid URL, let browser handle it
  }
});
