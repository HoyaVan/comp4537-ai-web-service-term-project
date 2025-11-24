import { adminMessages } from '/messages/admin.js';

const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Display API limit warning
function showApiLimitWarning(message) {
  // Check if warning already exists to avoid duplicates
  let warningEl = document.getElementById('api-limit-warning');
  if (!warningEl) {
    warningEl = document.createElement('div');
    warningEl.id = 'api-limit-warning';
    warningEl.className = 'api-limit-warning';
    document.body.appendChild(warningEl);
  }
  warningEl.textContent = message;
  warningEl.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (warningEl) {
      warningEl.classList.add('hidden');
    }
  }, 5000);
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

  // Check for API limit warning headers
  const limitExceeded = response.headers.get('X-API-Limit-Exceeded');
  const limitMessage = response.headers.get('X-API-Limit-Message');
  
  if (limitExceeded === 'true' && limitMessage) {
    // Display warning but continue with the request
    showApiLimitWarning(limitMessage);
  }

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

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

// Verify token with backend and get user info
async function verifyTokenAndGetUser(token) {
  try {
    const res = await fetch(window.getBackendUrl() + '/api/v1/auth/profile', {
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

// Fetch all users from backend
async function fetchAllUsers() {
  const token = getToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const res = await fetch(window.getBackendUrl() + '/api/v1/auth/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit'
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || adminMessages.failedToFetchUsers);
    }

    const data = await res.json();
    return data.data || [];
  } catch (error) {
    throw error;
  }
}

// Display users in the table
function displayUsers(users) {
  const usersList = document.getElementById('users-list');
  const userCount = document.getElementById('user-count');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');

  // Hide loading and error
  if (loading) loading.classList.add('hidden');
  if (error) error.classList.add('hidden');

  // Update user count
  if (userCount) {
    const count = users.length;
    userCount.textContent = adminMessages.userCount(count);
  }

  // Clear existing content
  if (usersList) {
    usersList.innerHTML = '';
  }

  if (!users || users.length === 0) {
    if (usersList) {
      usersList.innerHTML = `
        <div class="empty-state">
          <p>No users found.</p>
        </div>
      `;
    }
    return;
  }

  // Create table
  const table = document.createElement('table');
  table.className = 'users-table';

  // Create header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Email</th>
      <th>Name</th>
      <th>Created At</th>
    </tr>
  `;
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement('tbody');
  users.forEach(user => {
    const row = document.createElement('tr');
    const createdAt = user.createdAt 
      ? new Date(user.createdAt).toLocaleString()
      : 'N/A';
    
    row.innerHTML = `
      <td class="user-id">${user.id || 'N/A'}</td>
      <td class="user-email-cell">${user.email || 'N/A'}</td>
      <td class="user-name">${user.name || 'N/A'}</td>
      <td class="user-created">${createdAt}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  if (usersList) {
    usersList.appendChild(table);
  }
}

// Show error message
function showError(message) {
  const error = document.getElementById('error');
  const loading = document.getElementById('loading');
  
  if (loading) loading.classList.add('hidden');
  if (error) {
    error.textContent = message;
    error.classList.remove('hidden');
  }
}

// Load users
async function loadUsers() {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const refreshBtn = document.getElementById('refresh-btn');

  // Show loading, hide error
  if (loading) loading.classList.remove('hidden');
  if (error) error.classList.add('hidden');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const users = await fetchAllUsers();
    displayUsers(users);
  } catch (err) {
    showError(err.message || adminMessages.failedToLoadUsers);
  } finally {
    if (loading) loading.classList.add('hidden');
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const refreshBtn = document.getElementById('refresh-btn');

  // Check authentication
  if (!isAuthenticated()) {
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
    try {
      localStorage.removeItem('token');
    } catch (_) {}
    window.location.href = '/index.html';
    return;
  }

  // Check if user is admin - only admins can view API statistics
  if (!user || user.role !== 'admin') {
    alert(adminMessages.accessDenied);
    window.location.href = '/dashboard.html';
    return;
  }

  // Initialize header with navigation links
  await initLoggedInHeader([
    { href: '/dashboard.html', text: 'Dashboard' },
    { href: '/profile.html', text: 'Profile' }
  ]);

  // Setup refresh button (refresh all)
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await Promise.all([
        loadUsers(),
        loadEndpointStats(),
        loadConsumptionStats()
      ]);
    });
  }

  // Load all data on page load
  await Promise.all([
    loadUsers(),
    loadEndpointStats(),
    loadConsumptionStats()
  ]);
  
  // Setup refresh buttons
  const refreshEndpointsBtn = document.getElementById('refresh-endpoints-btn');
  const refreshConsumptionBtn = document.getElementById('refresh-consumption-btn');
  
  if (refreshEndpointsBtn) {
    refreshEndpointsBtn.addEventListener('click', loadEndpointStats);
  }
  
  if (refreshConsumptionBtn) {
    refreshConsumptionBtn.addEventListener('click', loadConsumptionStats);
  }
});

// Load endpoint statistics
async function loadEndpointStats() {
  const container = document.getElementById('endpoints-container');
  if (!container) return;
  
  container.innerHTML = `<p class="loading">${adminMessages.loadingEndpointStats}</p>`;
  
  try {
    const { ok, data } = await apiRequest('/api/v1/admin/stats/endpoints');
    if (ok && data.success) {
      displayEndpointStats(data.data || []);
    } else {
      container.innerHTML = `<p class="error">${adminMessages.failedToLoadEndpointStats}${data.message || adminMessages.unknownError}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<p class="error">${adminMessages.errorLoadingEndpointStats}${error.message}</p>`;
  }
}

// Display endpoint statistics
function displayEndpointStats(stats) {
  const container = document.getElementById('endpoints-container');
  if (!container) return;
  
  if (!stats || stats.length === 0) {
    container.innerHTML = `<p class="empty-state">${adminMessages.noEndpointStats}</p>`;
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'stats-table';
  
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Total Requests</th>
      <th>Latest User</th>
      <th>Last Call User Email</th>
      <th>Last Call User ID</th>
      <th>Latest Time</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  stats.forEach(stat => {
    const row = document.createElement('tr');
    
    // Format latest user (from lastCall)
    let latestUserHtml = '<div class="users-list-inline">';
    if (stat.lastCall && stat.lastCall.userId && stat.lastCall.userId !== 'anonymous') {
      const latestUser = stat.users?.find(u => u.userId === stat.lastCall.userId);
      if (latestUser) {
        const displayName = latestUser.name && latestUser.name !== 'Unknown' ? latestUser.name : (latestUser.email || 'Unknown');
        latestUserHtml += `<span class="user-badge" title="${latestUser.email || latestUser.userId}">${displayName}</span>`;
      } else {
        // Fallback to email if user not found in users list
        const displayName = stat.lastCall.email || stat.lastCall.userId || 'Unknown';
        latestUserHtml += `<span class="user-badge" title="${stat.lastCall.email || stat.lastCall.userId}">${displayName}</span>`;
      }
    } else {
      latestUserHtml += '<span class="muted-text">N/A</span>';
    }
    latestUserHtml += '</div>';
    
    const requestsCount = (stat.requests || 0).toLocaleString();
    
    // Format last call info
    const lastCallEmail = stat.lastCall?.email || '<span class="muted-text">N/A</span>';
    const lastCallUserId = stat.lastCall?.userId || '<span class="muted-text">N/A</span>';
    let lastCallTime = '<span class="muted-text">N/A</span>';
    if (stat.lastCall?.timestamp) {
      const date = new Date(stat.lastCall.timestamp);
      lastCallTime = date.toLocaleString();
    }
    
    row.innerHTML = `
      <td class="method-cell">${stat.method || 'N/A'}</td>
      <td class="endpoint-cell">${stat.endpoint || 'N/A'}</td>
      <td class="requests-cell">${requestsCount}</td>
      <td class="users-cell">${latestUserHtml}</td>
      <td class="email-cell">${lastCallEmail}</td>
      <td class="user-id-cell">${lastCallUserId}</td>
      <td class="timestamp-cell">${lastCallTime}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.innerHTML = '';
  container.appendChild(table);
}

// Load user consumption statistics
async function loadConsumptionStats() {
  const container = document.getElementById('consumption-container');
  if (!container) return;
  
  container.innerHTML = `<p class="loading">${adminMessages.loadingConsumptionStats}</p>`;
  
  try {
    const { ok, data } = await apiRequest('/api/v1/admin/stats/users');
    if (ok && data.success) {
      displayConsumptionStats(data.data || []);
    } else {
      container.innerHTML = `<p class="error">${adminMessages.failedToLoadConsumptionStats}${data.message || adminMessages.unknownError}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<p class="error">${adminMessages.errorLoadingConsumptionStats}${error.message}</p>`;
  }
}

// Display user consumption statistics
function displayConsumptionStats(stats) {
  const container = document.getElementById('consumption-container');
  if (!container) return;
  
  if (!stats || stats.length === 0) {
    container.innerHTML = `<p class="empty-state">${adminMessages.noConsumptionStats}</p>`;
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'stats-table consumption-table';
  
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>User ID</th>
      <th>Total Requests</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  stats.forEach(stat => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="name-cell">${stat.name || 'N/A'}</td>
      <td class="email-cell">${stat.email || 'N/A'}</td>
      <td class="user-id-cell">${stat.userId || 'N/A'}</td>
      <td class="requests-cell">${(stat.totalRequests || 0).toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.innerHTML = '';
  container.appendChild(table);
}
