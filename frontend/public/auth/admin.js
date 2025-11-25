import { adminMessages } from '/messages/admin.js';
import { requireAdmin, getCurrentUser } from './authGuard.js';

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


// Fetch all users from backend
async function fetchAllUsers() {
  try {
    const { ok, data } = await apiRequest('/api/v1/auth/users');
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
      <th>${adminMessages.tableHeaderEmail}</th>
      <th>${adminMessages.tableHeaderName}</th>
      <th>API Calls</th>
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
      : adminMessages.notAvailable;
    const apiCalls = user.api_calls !== undefined ? user.api_calls : (user.apiCalls !== undefined ? user.apiCalls : 0);
    
    row.innerHTML = `
      <td class="user-id">${user.id || adminMessages.notAvailable}</td>
      <td class="user-email-cell">${user.email || adminMessages.notAvailable}</td>
      <td class="user-name">${user.name || adminMessages.notAvailable}</td>
      <td class="user-api-calls">${apiCalls.toLocaleString()}</td>
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
  const refreshBtn = document.getElementById('refresh-btn');

  // Require admin authentication - will redirect if not admin
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return;
  }

  // Wait for headerUtils to be ready
  let headerUtilsReady = false;
  if (window.__headerUtilsReady && window.initLoggedInHeader) {
    headerUtilsReady = true;
  } else {
    // Wait up to 2 seconds for headerUtils
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (window.__headerUtilsReady && window.initLoggedInHeader) {
        headerUtilsReady = true;
        break;
      }
    }
  }

  // Initialize header with navigation links
  if (headerUtilsReady && typeof window.initLoggedInHeader === 'function') {
    try {
      await window.initLoggedInHeader([
        { href: '/dashboard', text: 'Dashboard' },
        { href: '/profile', text: 'Profile' }
      ]);
    } catch (error) {
      console.error('[Admin] Error initializing header:', error);
    }
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
  const refreshUsersBtn = document.getElementById('refresh-users-btn');
  
  if (refreshEndpointsBtn) {
    refreshEndpointsBtn.addEventListener('click', loadEndpointStats);
  }
  
  if (refreshConsumptionBtn) {
    refreshConsumptionBtn.addEventListener('click', loadConsumptionStats);
  }
  
  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener('click', loadUsers);
  }
}

// Initialize admin when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__adminInitialized) {
      initAdmin().then(() => {
        window.__adminInitialized = true;
      }).catch(err => {
        console.error('[Admin] Initialization failed:', err);
      });
    }
  });
} else {
  if (!window.__adminInitialized) {
    initAdmin().then(() => {
      window.__adminInitialized = true;
    }).catch(err => {
      console.error('[Admin] Initialization failed:', err);
    });
  }
}

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
      <th>${adminMessages.tableHeaderMethod}</th>
      <th>${adminMessages.tableHeaderEndpoint}</th>
      <th>${adminMessages.tableHeaderTotalRequests}</th>
      <th>${adminMessages.tableHeaderLatestUser}</th>
      <th>${adminMessages.tableHeaderLastCallUserEmail}</th>
      <th>${adminMessages.tableHeaderLastCallUserId}</th>
      <th>${adminMessages.tableHeaderLatestTime}</th>
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
        const displayName = latestUser.name && latestUser.name !== adminMessages.unknown ? latestUser.name : (latestUser.email || adminMessages.unknown);
        latestUserHtml += `<span class="user-badge" title="${latestUser.email || latestUser.userId}">${displayName}</span>`;
      } else {
        // Fallback to email if user not found in users list
        const displayName = stat.lastCall.email || stat.lastCall.userId || adminMessages.unknown;
        latestUserHtml += `<span class="user-badge" title="${stat.lastCall.email || stat.lastCall.userId}">${displayName}</span>`;
      }
    } else {
      latestUserHtml += `<span class="muted-text">${adminMessages.notAvailable}</span>`;
    }
    latestUserHtml += '</div>';
    
    const requestsCount = (stat.requests || 0).toLocaleString();
    
    // Format last call info
    const lastCallEmail = stat.lastCall?.email || `<span class="muted-text">${adminMessages.notAvailable}</span>`;
    const lastCallUserId = stat.lastCall?.userId || `<span class="muted-text">${adminMessages.notAvailable}</span>`;
    let lastCallTime = `<span class="muted-text">${adminMessages.notAvailable}</span>`;
    if (stat.lastCall?.timestamp) {
      const date = new Date(stat.lastCall.timestamp);
      lastCallTime = date.toLocaleString();
    }
    
    row.innerHTML = `
      <td class="method-cell">${stat.method || adminMessages.notAvailable}</td>
      <td class="endpoint-cell">${stat.endpoint || adminMessages.notAvailable}</td>
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
      <th>${adminMessages.tableHeaderName}</th>
      <th>${adminMessages.tableHeaderEmail}</th>
      <th>${adminMessages.tableHeaderUserId}</th>
      <th>${adminMessages.tableHeaderTotalRequests}</th>
      <th>${adminMessages.tableHeaderActions}</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  stats.forEach(stat => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="name-cell">${stat.name || adminMessages.notAvailable}</td>
      <td class="email-cell">${stat.email || adminMessages.notAvailable}</td>
      <td class="user-id-cell">${stat.userId || adminMessages.notAvailable}</td>
      <td class="requests-cell">${(stat.totalRequests || 0).toLocaleString()}</td>
      <td class="actions-cell">
        <button class="admin-btn-small view-user-api-btn" data-user-id="${stat.userId}" title="View API consumption details">
          ${adminMessages.viewDetailsButton}
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.innerHTML = '';
  container.appendChild(table);
  
  // Add click handlers for view details buttons
  const viewButtons = container.querySelectorAll('.view-user-api-btn');
  viewButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      if (userId) {
        await viewUserApiConsumption(userId);
      }
    });
  });
}

// View individual user API consumption
async function viewUserApiConsumption(userId) {
  try {
    const { ok, data } = await apiRequest(`/api/v1/admin/users/${userId}/api-consumption`);
    if (ok && data.success) {
      showUserApiConsumptionModal(data.data);
    } else {
      alert(`${adminMessages.modalFailedToLoad}${data.message || adminMessages.unknownError}`);
    }
  } catch (error) {
    console.error('Error loading user API consumption:', error);
    alert(`${adminMessages.modalErrorLoading}${error.message}`);
  }
}

// Show user API consumption in a modal
function showUserApiConsumptionModal(userData) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  
  const consumption = userData.apiConsumption;
  const endpointBreakdown = consumption.endpointBreakdown || [];
  
  let endpointTableHtml = '';
  if (endpointBreakdown.length > 0) {
    endpointTableHtml = `
      <table class="stats-table modal-endpoint-table">
        <thead>
          <tr>
            <th>${adminMessages.tableHeaderMethod}</th>
            <th>${adminMessages.tableHeaderEndpoint}</th>
            <th>${adminMessages.tableHeaderRequests}</th>
          </tr>
        </thead>
        <tbody>
          ${endpointBreakdown.map(endpoint => `
            <tr>
              <td><span class="method-badge method-badge-${(endpoint.method || 'GET').toLowerCase()}">${endpoint.method || adminMessages.modalNotAvailable}</span></td>
              <td class="endpoint-cell">${endpoint.endpoint || adminMessages.modalNotAvailable}</td>
              <td class="requests-cell">${(endpoint.requests || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    endpointTableHtml = `<p class="muted-text">${adminMessages.modalNoEndpointData}</p>`;
  }
  
  const userName = userData.user.name || userData.user.email || adminMessages.modalNotAvailable;
  const userEmail = userData.user.email || adminMessages.modalNotAvailable;
  const userId = userData.user.id || adminMessages.modalNotAvailable;
  const userRole = userData.user.role || 'user';
  const callLimit = consumption.callsLimit === 'unlimited' ? adminMessages.modalUnlimited : consumption.callsLimit;
  const remainingCalls = consumption.remainingCalls === null ? adminMessages.modalUnlimited : consumption.remainingCalls;
  const limitExceeded = consumption.hasExceededLimit ? adminMessages.modalYes : adminMessages.modalNo;
  
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${adminMessages.modalTitle} ${userName}</h2>
      <button class="close-modal-btn">&times;</button>
    </div>
    <div class="modal-body">
      <p><strong>${adminMessages.modalUserLabel}</strong> ${userData.user.name || adminMessages.modalNotAvailable} (${userEmail})</p>
      <p><strong>${adminMessages.modalUserIdLabel}</strong> ${userId}</p>
      <p><strong>${adminMessages.modalRoleLabel}</strong> ${userRole}</p>
      <hr>
      <p><strong>${adminMessages.modalTotalCallsLabel}</strong> ${consumption.callsUsed || 0}</p>
      <p><strong>${adminMessages.modalCallLimitLabel}</strong> ${callLimit}</p>
      <p><strong>${adminMessages.modalRemainingCallsLabel}</strong> ${remainingCalls}</p>
      <p><strong>${adminMessages.modalLimitExceededLabel}</strong> ${limitExceeded}</p>
      <h3>${adminMessages.modalEndpointBreakdownTitle}</h3>
      ${endpointTableHtml}
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close modal handlers
  const closeBtn = modal.querySelector('.close-modal-btn');
  const closeModal = () => {
    document.body.removeChild(overlay);
  };
  
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
}
