// Backend URL configuration
// This file centralizes the backend URL to avoid duplication across the application
window.BACKEND_URL = 'https://dj-clownfish-uxa88.ondigitalocean.app';

// Get backend URL helper function - ensures URL is normalized and cached
window.getBackendUrl = function() {
  if (!window.__BACKEND_URL__) {
    window.__BACKEND_URL__ = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  }
  return window.__BACKEND_URL__;
};

