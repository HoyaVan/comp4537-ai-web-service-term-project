const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Check if user is authenticated
function isAuthenticated() {
  try {
    const token = localStorage.getItem('token');
    return !!token;
  } catch (_) {
    return false;
  }
}

// Get token from localStorage
function getToken() {
  try {
    return localStorage.getItem('token');
  } catch (_) {
    return null;
  }
}

// Decode JWT token to get user info (basic decode, doesn't verify signature)
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (_) {
    return null;
  }
}

// Verify token with backend and get user info
async function verifyTokenAndGetUser(token) {
  try {
    const res = await fetch(BACKEND_URL + '/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit'
    });
    if (!res.ok) {
      return { valid: false, user: null };
    }
    const data = await res.json();
    return { valid: true, user: data.data || data };
  } catch (_) {
    return { valid: false, user: null };
  }
}

// Logout function
function logout() {
  try {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
  } catch (_) {
    window.location.href = '/index.html';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const backend = document.getElementById('backend-url');
  const userEmail = document.getElementById('user-email');
  const infoEmail = document.getElementById('info-email');
  const infoUserId = document.getElementById('info-user-id');
  const logoutBtn = document.getElementById('logout-btn');

  if (backend) backend.textContent = BACKEND_URL;

  // Check authentication
  if (!isAuthenticated()) {
    // Redirect to index if not authenticated
    window.location.href = '/index.html';
    return;
  }

  const token = getToken();
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Verify token with backend and get user info
  const { valid, user } = await verifyTokenAndGetUser(token);
  if (!valid) {
    // Token is invalid, remove it and redirect
    try {
      localStorage.removeItem('token');
    } catch (_) {}
    window.location.href = '/index.html';
    return;
  }

  // Display user info from backend
  if (user) {
    const email = user.email || '';
    const userId = user.id || user.userId || 'N/A';
    
    if (userEmail) userEmail.textContent = email;
    if (infoEmail) infoEmail.textContent = email;
    if (infoUserId) infoUserId.textContent = userId;
  } else {
    // Fallback to token decode if backend doesn't return user
    const decoded = decodeToken(token);
    if (decoded && decoded.email) {
      if (userEmail) userEmail.textContent = decoded.email;
      if (infoEmail) infoEmail.textContent = decoded.email;
      if (infoUserId) infoUserId.textContent = decoded.userId || 'N/A';
    }
  }

  // Setup logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

