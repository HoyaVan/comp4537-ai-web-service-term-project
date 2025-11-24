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

// Make authenticated API request
async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(BACKEND_URL + url, {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'include',
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Load user info
async function loadUserInfo() {
  const { ok, data } = await apiRequest('/api/auth/profile');
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Display user information
function displayUserInfo(user) {
  const container = document.getElementById('user-info-container');
  if (!container || !user) {
    if (container) {
      container.innerHTML = '<p class="muted-text">Unable to load user information.</p>';
    }
    return;
  }

  const html = `
    <div class="user-info-grid">
      <div class="user-info-item">
        <span class="info-label">Name</span>
        <span class="info-value">${user.name || 'Not set'}</span>
      </div>
      <div class="user-info-item">
        <span class="info-label">Email</span>
        <span class="info-value">${user.email || 'N/A'}</span>
      </div>
      <div class="user-info-item">
        <span class="info-label">User ID</span>
        <span class="info-value info-value-monospace">${user.id || 'N/A'}</span>
      </div>
      <div class="user-info-item">
        <span class="info-label">Role</span>
        <span class="info-value">
          <span class="role-badge role-badge-${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span>
        </span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Display API consumption
function displayApiConsumption(user) {
  const container = document.getElementById('api-consumption-container');
  if (!container || !user || !user.apiConsumption) {
    if (container) {
      container.innerHTML = '<p class="muted-text">No API consumption data available.</p>';
    }
    return;
  }

  const consumption = user.apiConsumption;
  const endpointBreakdown = consumption.endpointBreakdown || [];

  // Only show per-endpoint breakdown (individual API consumption)
  let html = '';
  
  if (endpointBreakdown.length > 0) {
    html = `
      <div style="overflow-x: auto;">
        <table class="endpoint-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Requests</th>
            </tr>
          </thead>
          <tbody>
            ${endpointBreakdown.map(endpoint => `
              <tr>
                <td>
                  <span class="method-badge method-badge-${(endpoint.method || 'GET').toLowerCase()}">
                    ${endpoint.method || 'N/A'}
                  </span>
                </td>
                <td class="endpoint-cell">${endpoint.endpoint || 'N/A'}</td>
                <td class="requests-cell">${(endpoint.requests || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    html = `
      <div style="padding: 12px; background: #f8fafc; border-radius: 6px; color: var(--muted); font-size: 14px;">
        No endpoint-specific data available yet. Start making API calls to see your usage breakdown.
      </div>
    `;
  }

  container.innerHTML = html;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return;
  }

  // Load user info
  const user = await loadUserInfo();
  
  if (!user) {
    alert('Failed to load user information. Please try logging in again.');
    window.location.href = '/index.html';
    return;
  }

  // Display user information
  displayUserInfo(user);
  
  // Display API consumption
  displayApiConsumption(user);

  // Initialize header with navigation links
  if (typeof initLoggedInHeader === 'function') {
    const additionalLinks = [
      { href: '/dashboard.html', text: 'Dashboard' }
    ];
    
    // Only add Admin link if user is an admin
    if (user.role === 'admin') {
      additionalLinks.push({ href: '/admin.html', text: 'Admin' });
    }
    
    await initLoggedInHeader(additionalLinks);
  }
});

