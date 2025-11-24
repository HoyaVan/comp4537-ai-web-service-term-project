// Cache for loaded partials
const partialCache = {};

// Fetch partial HTML from the partials directory
async function fetchPartial(partialName) {
  // Return cached version if available
  if (partialCache[partialName]) {
    return partialCache[partialName];
  }

  try {
    const response = await fetch(`/partials/${partialName}`);
    if (!response.ok) {
      throw new Error(`Failed to load partial: ${partialName}`);
    }
    const html = await response.text();
    // Cache the result
    partialCache[partialName] = html.trim();
    return partialCache[partialName];
  } catch (error) {
    console.error(`Error loading partial ${partialName}:`, error);
    throw error;
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
 * Fetches the header partial from /partials/logged-out-header.html
 */
async function initLoggedOutHeader() {
  try {
    const html = await fetchPartial('logged-out-header.html');
    
    // Find or create header container
    const existingHeader = document.querySelector('header.header');
    if (existingHeader) {
      existingHeader.outerHTML = html;
    } else {
      // If no header exists, prepend to body
      document.body.insertAdjacentHTML('afterbegin', html);
    }
  } catch (error) {
    console.error('Failed to initialize logged-out header:', error);
    // Fallback: create a basic header if fetch fails
    const existingHeader = document.querySelector('header.header');
    const fallbackHtml = '<header class="header"><div class="header-content"><a href="/" class="logo">DJ Clownfish</a><nav class="header-nav"><a href="/login.html" class="header-btn">Login</a><a href="/signup.html" class="header-btn header-btn-primary">Sign Up</a></nav></div></header>';
    if (existingHeader) {
      existingHeader.outerHTML = fallbackHtml;
    } else {
      document.body.insertAdjacentHTML('afterbegin', fallbackHtml);
    }
  }
}

/**
 * Initialize the logged-in header
 * @param {Array<string>} additionalLinks - Array of link objects with {href, text} or just text strings for simple links
 * Example: [{href: '/dashboard.html', text: 'Dashboard'}, {href: '/admin.html', text: 'Admin'}]
 * Or simple: ['Dashboard', 'Admin'] for auto-generating links
 * Fetches the header partial from /partials/logged-in-header.html
 */
async function initLoggedInHeader(additionalLinks = []) {
  try {
    const html = await fetchPartial('logged-in-header.html');
    
    // Find or create header container
    const existingHeader = document.querySelector('header.header');
    if (existingHeader) {
      existingHeader.outerHTML = html;
    } else {
      // If no header exists, prepend to body
      document.body.insertAdjacentHTML('afterbegin', html);
    }
  } catch (error) {
    console.error('Failed to initialize logged-in header:', error);
    // Fallback: create a basic header if fetch fails
    const existingHeader = document.querySelector('header.header');
    const fallbackHtml = '<header class="header"><div class="header-content"><a href="/" class="logo">DJ Clownfish</a><nav class="header-nav" id="header-nav"><span id="user-email" class="user-email"></span><button id="logout-btn" class="header-btn">Logout</button></nav></div></header>';
    if (existingHeader) {
      existingHeader.outerHTML = fallbackHtml;
    } else {
      document.body.insertAdjacentHTML('afterbegin', fallbackHtml);
    }
  }
  
  // Wait for DOM to update
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Add additional navigation links if provided
  const headerNav = document.getElementById('header-nav');
  let profileElement = null; // Track Profile element for Spotify button insertion
  
  if (headerNav && additionalLinks.length > 0) {
    const userEmailSpan = document.getElementById('user-email');
    
    // Insert links before user email
    additionalLinks.forEach(link => {
      let href, text, onClick, isButton, className;
      if (typeof link === 'string') {
        // Simple string format - generate href from text
        text = link;
        href = '/' + text.toLowerCase().replace(/\s+/g, '-') + '.html';
      } else {
        // Object format
        href = link.href || '#';
        text = link.text;
        onClick = link.onClick;
        isButton = link.isButton || false;
        className = link.className || '';
      }
      
      let element;
      if (isButton || onClick) {
        // Create button element
        element = document.createElement('button');
        element.type = 'button';
        element.className = 'header-btn' + (className ? ' ' + className : '');
        element.textContent = text;
        if (onClick) {
          element.addEventListener('click', onClick);
        }
      } else {
        // Create anchor element
        element = document.createElement('a');
        element.href = href;
        element.className = 'header-btn' + (className ? ' ' + className : '');
        element.textContent = text;
      }
      
      headerNav.insertBefore(element, userEmailSpan);
      
      // Track Profile element for Spotify button insertion
      if (text === 'Profile' || href.includes('profile')) {
        profileElement = element;
      }
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
  
  // Add Spotify OAuth button next to Profile button
  // Use a small delay to ensure DOM is fully ready
  setTimeout(() => {
    const headerNavForSpotify = document.getElementById('header-nav');
    if (headerNavForSpotify && !document.getElementById('spotify-oauth-btn')) {
      // Try to find Profile link - use tracked element first, then search
      let profileLink = profileElement;
      if (!profileLink && headerNavForSpotify) {
        // Search through all children of headerNav (more robust search)
        profileLink = Array.from(headerNavForSpotify.children).find(
          el => {
            const href = el.href || '';
            const text = (el.textContent || '').trim().toLowerCase();
            return (el.tagName === 'A' && (href.toLowerCase().includes('profile') || text === 'profile')) ||
                   (el.tagName === 'BUTTON' && text === 'profile');
          }
        );
      }
      
      const spotifyBtn = document.createElement('button');
      spotifyBtn.id = 'spotify-oauth-btn';
      spotifyBtn.type = 'button';
      spotifyBtn.className = 'header-btn spotify-btn';
      spotifyBtn.textContent = '🎵 Connect Spotify';
      spotifyBtn.style.cursor = 'pointer';
      spotifyBtn.addEventListener('click', function() {
        const backendUrl = window.getBackendUrl ? window.getBackendUrl() : (window.BACKEND_URL || 'http://localhost:3000');
        window.location.href = backendUrl + '/api/spotify/auth';
      });
      
      // Insert right after Profile link if it exists, otherwise before user email
      if (profileLink && profileLink.parentNode === headerNavForSpotify) {
        // Insert after the Profile link using insertBefore with nextSibling
        if (profileLink.nextSibling) {
          headerNavForSpotify.insertBefore(spotifyBtn, profileLink.nextSibling);
        } else {
          // If Profile is the last element, append after it
          headerNavForSpotify.appendChild(spotifyBtn);
        }
      } else {
        // If no Profile link, insert before user email
        const userEmailSpan = document.getElementById('user-email');
        if (userEmailSpan && userEmailSpan.parentNode === headerNavForSpotify) {
          headerNavForSpotify.insertBefore(spotifyBtn, userEmailSpan);
        } else if (headerNavForSpotify) {
          // Fallback: add at the end
          headerNavForSpotify.appendChild(spotifyBtn);
        }
      }
    }
  }, 100);
}
