const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

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
    const res = await fetch(window.getBackendUrl() + '/api/auth/profile', {
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
    const res = await fetch(window.getBackendUrl() + '/api/auth/users', {
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
      throw new Error(errorData.message || 'Failed to fetch users');
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
    userCount.textContent = `${count} user${count !== 1 ? 's' : ''}`;
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
    showError(err.message || 'Failed to load users. Please try again.');
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
    alert('Access denied. Admin privileges required.');
    window.location.href = '/dashboard.html';
    return;
  }

  // Initialize header with Dashboard link
  await initLoggedInHeader([{ href: '/dashboard.html', text: 'Dashboard' }]);

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
  
  container.innerHTML = '<p class="loading">Loading endpoint statistics...</p>';
  
  try {
    const { ok, data } = await apiRequest('/api/admin/stats/endpoints');
    if (ok && data.success) {
      displayEndpointStats(data.data || []);
    } else {
      container.innerHTML = `<p class="error">Failed to load endpoint statistics: ${data.message || 'Unknown error'}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading endpoint statistics: ${error.message}</p>`;
  }
}

// Display endpoint statistics
function displayEndpointStats(stats) {
  const container = document.getElementById('endpoints-container');
  if (!container) return;
  
  if (!stats || stats.length === 0) {
    container.innerHTML = '<p class="empty-state">No endpoint statistics available.</p>';
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
      <th>Users</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  stats.forEach(stat => {
    const row = document.createElement('tr');
    
    // Format users list
    let usersHtml = '<div class="users-list-inline">';
    if (stat.users && stat.users.length > 0) {
      stat.users.forEach((user, index) => {
        if (index > 0) usersHtml += ', ';
        usersHtml += `<span class="user-badge" title="${user.email}">${user.name || user.email || 'Unknown'}</span>`;
        if (user.count > 1) {
          usersHtml += ` <span class="user-count-badge">(${user.count})</span>`;
        }
      });
    } else {
      usersHtml += '<span class="muted-text">Anonymous</span>';
    }
    usersHtml += '</div>';
    
    row.innerHTML = `
      <td class="method-cell">${stat.method || 'N/A'}</td>
      <td class="endpoint-cell">${stat.endpoint || 'N/A'}</td>
      <td class="requests-cell">${(stat.requests || 0).toLocaleString()}</td>
      <td class="users-cell">${usersHtml}</td>
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
  
  container.innerHTML = '<p class="loading">Loading consumption statistics...</p>';
  
  try {
    const { ok, data } = await apiRequest('/api/admin/stats/users');
    if (ok && data.success) {
      displayConsumptionStats(data.data || []);
    } else {
      container.innerHTML = `<p class="error">Failed to load consumption statistics: ${data.message || 'Unknown error'}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading consumption statistics: ${error.message}</p>`;
  }
}

// Display user consumption statistics
function displayConsumptionStats(stats) {
  const container = document.getElementById('consumption-container');
  if (!container) return;
  
  if (!stats || stats.length === 0) {
    container.innerHTML = '<p class="empty-state">No consumption statistics available.</p>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'stats-table';
  
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
