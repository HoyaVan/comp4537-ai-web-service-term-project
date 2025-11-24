import { profileMessages } from '/messages/profile.js';
import { commonMessages } from '/messages/common.js';

const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Check if user is authenticated using authService
async function isAuthenticated() {
  if (window.authService) {
    return await window.authService.isAuthenticated();
  }
  return false;
}

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
      container.innerHTML = `<p class="muted-text">${profileMessages.unableToLoadUserInfo}</p>`;
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
      container.innerHTML = `<p class="muted-text">${profileMessages.noApiConsumptionData}</p>`;
    }
    return;
  }

  const consumption = user.apiConsumption;
  const endpointBreakdown = consumption.endpointBreakdown || [];
  const callsUsed = consumption.callsUsed || 0;
  const callsLimit = consumption.callsLimit || 20;
  const remainingCalls = consumption.remainingCalls !== undefined ? consumption.remainingCalls : (callsLimit - callsUsed);
  const hasExceeded = consumption.hasExceededLimit || false;

  // Show warning banner if limit exceeded
  let warningHtml = '';
  if (hasExceeded) {
    warningHtml = `
      <div style="margin-bottom: 16px; padding: 12px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 14px;">
        <strong>⚠️ ${profileMessages.apiLimitExceeded}:</strong> ${profileMessages.apiLimitExceededMessage(callsLimit)}
      </div>
    `;
  } else if (remainingCalls !== null && remainingCalls <= 5) {
    warningHtml = `
      <div style="margin-bottom: 16px; padding: 12px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 14px;">
        <strong>⚠️ ${profileMessages.warningRemaining(remainingCalls)}</strong>
      </div>
    `;
  }

  // Show remaining calls info
  let callsInfoHtml = '';
  if (remainingCalls !== null) {
    callsInfoHtml = `
      <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 14px;">
        <strong>${profileMessages.freeApiCalls(callsUsed, callsLimit)}</strong>
        ${remainingCalls > 0 ? profileMessages.remainingCalls(remainingCalls) : profileMessages.limitExceeded}
      </div>
    `;
  }

  // Only show per-endpoint breakdown (individual API consumption)
  let tableHtml = '';
  
  if (endpointBreakdown.length > 0) {
    tableHtml = `
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
    tableHtml = `
      <div style="padding: 12px; background: #f8fafc; border-radius: 6px; color: var(--muted); font-size: 14px;">
        ${profileMessages.noEndpointData}
      </div>
    `;
  }

  container.innerHTML = warningHtml + callsInfoHtml + tableHtml;
}

// Initialize profile page
async function initProfile() {
  // Check authentication
  const auth = await isAuthenticated();
  if (!auth) {
    window.location.href = '/login';
    return;
  }

  // Load user info
  const user = await loadUserInfo();
  
  if (!user) {
    alert(profileMessages.failedToLoadUserInfo);
    window.location.href = '/';
    return;
  }

  // Display user information
  displayUserInfo(user);
  
  // Display API consumption
  displayApiConsumption(user);

  // Wait for headerUtils to be ready if needed
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
      const additionalLinks = [
        { href: '/dashboard', text: 'Dashboard' }
      ];
      
      // Only add Admin link if user is an admin
      if (user.role === 'admin') {
        additionalLinks.push({ href: '/admin', text: 'Admin' });
      }
      
      await window.initLoggedInHeader(additionalLinks);
      console.log('Header initialized successfully');
    } catch (error) {
      console.error('Error initializing header:', error);
    }
  } else {
    console.error('initLoggedInHeader not available after waiting. headerUtils.js may not have loaded correctly.');
    console.log('window.__headerUtilsReady:', window.__headerUtilsReady);
    console.log('window.initLoggedInHeader:', typeof window.initLoggedInHeader);
  }
}

// Fallback: Initialize if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfile);
} else if (!window.__profileInitialized) {
  setTimeout(() => {
    if (!window.__profileInitialized) {
      initProfile();
    }
  }, 100);
}

