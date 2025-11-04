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

  // Initialize header with Dashboard link
  await initLoggedInHeader([{ href: '/dashboard.html', text: 'Dashboard' }]);

  // Setup refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUsers);
  }

  // Load users on page load
  await loadUsers();
});
