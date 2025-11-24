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

// Make authenticated API request using authService
async function apiRequest(url, options = {}) {
  // Use authService if available
  if (window.authService) {
    const response = await window.authService.apiRequest(url, options);
    
    // Check for API limit warning headers
    const limitExceeded = response.headers.get('X-API-Limit-Exceeded');
    const limitMessage = response.headers.get('X-API-Limit-Message');
    
    if (limitExceeded === 'true' && limitMessage) {
      showApiLimitWarning(limitMessage);
    }

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  }

  // Fallback
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(BACKEND_URL + url, {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'include',
  });

  const limitExceeded = response.headers.get('X-API-Limit-Exceeded');
  const limitMessage = response.headers.get('X-API-Limit-Message');
  
  if (limitExceeded === 'true' && limitMessage) {
    showApiLimitWarning(limitMessage);
  }

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Check if user is authenticated
// Check if user is authenticated using authService
async function isAuthenticated() {
  if (window.authService) {
    return await window.authService.isAuthenticated();
  }
  return false;
}

// Fetch all users from backend
async function fetchAllUsers() {
  try {
    const { ok, data } = await apiRequest('/api/auth/users');
    if (!ok || !data.success) {
      throw new Error(data.message || adminMessages.failedToFetchUsers);
    }
    return data.data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
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

// Initialize admin page
async function initAdmin() {
  console.log('[Admin] initAdmin called');
  const refreshBtn = document.getElementById('refresh-btn');

  // Check authentication
  console.log('[Admin] Checking authentication...');
  const auth = await isAuthenticated();
  console.log('[Admin] Authentication result:', auth);
  if (!auth) {
    console.log('[Admin] Not authenticated, redirecting to login');
    window.location.href = '/login';
    return;
  }

  // Get user from authService
  const user = window.authService ? window.authService.getCurrentUser() : null;
  if (!user) {
    // Try to refresh
    const isAuth = await window.authService.isAuthenticated();
    if (!isAuth) {
      window.location.href = '/login';
      return;
    }
  }

  // Check if user is admin - only admins can view API statistics
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  if (!currentUser || currentUser.role !== 'admin') {
    alert(adminMessages.accessDenied);
    window.location.href = '/dashboard';
    return;
  }

  console.log('[Admin] Checking headerUtils availability...');
  console.log('[Admin] window.__headerUtilsReady:', window.__headerUtilsReady);
  console.log('[Admin] window.initLoggedInHeader:', typeof window.initLoggedInHeader);
  
  // Wait for headerUtils to be ready if needed
  let headerUtilsReady = false;
  if (window.__headerUtilsReady && window.initLoggedInHeader) {
    headerUtilsReady = true;
    console.log('[Admin] headerUtils ready immediately');
  } else {
    console.log('[Admin] Waiting for headerUtils...');
    // Wait up to 2 seconds for headerUtils
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (window.__headerUtilsReady && window.initLoggedInHeader) {
        headerUtilsReady = true;
        console.log('[Admin] headerUtils ready after', (i + 1) * 50, 'ms');
        break;
      }
    }
  }

  // Initialize header with navigation links
  console.log('[Admin] Initializing header, headerUtilsReady:', headerUtilsReady);
  if (headerUtilsReady && typeof window.initLoggedInHeader === 'function') {
    try {
      console.log('[Admin] Calling initLoggedInHeader...');
      await window.initLoggedInHeader([
        { href: '/dashboard', text: 'Dashboard' },
        { href: '/profile', text: 'Profile' }
      ]);
      console.log('[Admin] Header initialized successfully');
    } catch (error) {
      console.error('[Admin] Error initializing header:', error);
      console.error('[Admin] Error stack:', error.stack);
    }
  } else {
    console.error('[Admin] initLoggedInHeader not available after waiting.');
    console.error('[Admin] headerUtilsReady:', headerUtilsReady);
    console.error('[Admin] window.__headerUtilsReady:', window.__headerUtilsReady);
    console.error('[Admin] window.initLoggedInHeader type:', typeof window.initLoggedInHeader);
  }

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
  try {
    await Promise.all([
      loadUsers(),
      loadEndpointStats(),
      loadConsumptionStats()
    ]);
    console.log('All admin data loaded successfully');
  } catch (error) {
    console.error('Error loading admin data:', error);
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.textContent = `Error loading data: ${error.message}`;
      errorEl.classList.remove('hidden');
    }
  }
  
  // Setup refresh buttons
  const refreshEndpointsBtn = document.getElementById('refresh-endpoints-btn');
  const refreshConsumptionBtn = document.getElementById('refresh-consumption-btn');
  
  if (refreshEndpointsBtn) {
    refreshEndpointsBtn.addEventListener('click', loadEndpointStats);
  }
  
  if (refreshConsumptionBtn) {
    refreshConsumptionBtn.addEventListener('click', loadConsumptionStats);
  }
}

// Fallback: Initialize if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else if (!window.__adminInitialized) {
  setTimeout(() => {
    if (!window.__adminInitialized) {
      initAdmin();
    }
  }, 100);
}

// Load endpoint statistics
async function loadEndpointStats() {
  const container = document.getElementById('endpoints-container');
  if (!container) return;
  
  container.innerHTML = `<p class="loading">${adminMessages.loadingEndpointStats}</p>`;
  
  try {
    const { ok, data } = await apiRequest('/api/admin/stats/endpoints');
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
    const { ok, data } = await apiRequest('/api/admin/stats/users');
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
