const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Header templates embedded to avoid fetch requests (which trigger Cloudflare cookie warnings)
const LOGGED_OUT_HEADER_HTML = `
<header class="header">
    <div class="header-content">
        <a href="/" class="logo">DJ Clownfish</a>
        <nav class="header-nav">
            <a href="/login.html" class="header-btn">Login</a>
            <a href="/signup.html" class="header-btn header-btn-primary">Sign Up</a>
        </nav>
    </div>
</header>`;

const LOGGED_IN_HEADER_HTML = `
<header class="header">
    <div class="header-content">
        <a href="/" class="logo">DJ Clownfish</a>
        <nav class="header-nav" id="header-nav">
            <!-- Navigation links will be inserted here by JavaScript -->
            <span id="user-email" class="user-email"></span>
            <button id="logout-btn" class="header-btn">Logout</button>
        </nav>
    </div>
</header>`;

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

/**
 * Initialize the logged-out header
 * Simple header with Login and Sign Up links
 * Uses embedded HTML template to avoid fetch requests that trigger Cloudflare cookie warnings
 */
function initLoggedOutHeader() {
  // Find or create header container
  const existingHeader = document.querySelector('header.header');
  if (existingHeader) {
    existingHeader.outerHTML = LOGGED_OUT_HEADER_HTML.trim();
  } else {
    // If no header exists, prepend to body
    document.body.insertAdjacentHTML('afterbegin', LOGGED_OUT_HEADER_HTML.trim());
  }
}

/**
 * Initialize the logged-in header
 * @param {Array<string>} additionalLinks - Array of link objects with {href, text} or just text strings for simple links
 * Example: [{href: '/dashboard.html', text: 'Dashboard'}, {href: '/admin.html', text: 'Admin'}]
 * Or simple: ['Dashboard', 'Admin'] for auto-generating links
 * Uses embedded HTML template to avoid fetch requests that trigger Cloudflare cookie warnings
 */
async function initLoggedInHeader(additionalLinks = []) {
  // Find or create header container
  const existingHeader = document.querySelector('header.header');
  if (existingHeader) {
    existingHeader.outerHTML = LOGGED_IN_HEADER_HTML.trim();
  } else {
    // If no header exists, prepend to body
    document.body.insertAdjacentHTML('afterbegin', LOGGED_IN_HEADER_HTML.trim());
  }
  
  // Wait for DOM to update
  await new Promise(resolve => setTimeout(resolve, 0));
    
    // Add additional navigation links if provided
    const headerNav = document.getElementById('header-nav');
    if (headerNav && additionalLinks.length > 0) {
      const userEmailSpan = document.getElementById('user-email');
      
      // Insert links before user email
      additionalLinks.forEach(link => {
        let href, text;
        if (typeof link === 'string') {
          // Simple string format - generate href from text
          text = link;
          href = '/' + text.toLowerCase().replace(/\s+/g, '-') + '.html';
        } else {
          // Object format
          href = link.href;
          text = link.text;
        }
        
        const linkElement = document.createElement('a');
        linkElement.href = href;
        linkElement.className = 'header-btn';
        linkElement.textContent = text;
        headerNav.insertBefore(linkElement, userEmailSpan);
      });
    }
  
  // Setup logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Get user info and display email
  const token = getToken();
  if (token) {
    const { valid, user } = await verifyTokenAndGetUser(token);
    const userEmail = document.getElementById('user-email');
    if (user && userEmail) {
      userEmail.textContent = user.email || '';
    }
  }
}
