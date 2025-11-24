// Cache for loaded partials
const partialCache = {};

// Fetch partial HTML from the partials directory
async function fetchPartial(partialName) {
  console.log("[headerUtils] fetchPartial called for:", partialName);
  // Return cached version if available
  if (partialCache[partialName]) {
    console.log("[headerUtils] Using cached partial:", partialName);
    return partialCache[partialName];
  }

  try {
    const url = `/partials/${partialName}`;
    console.log("[headerUtils] Fetching partial from:", url);
    const response = await fetch(url);
    console.log(
      "[headerUtils] Fetch response status:",
      response.status,
      response.statusText
    );
    console.log(
      "[headerUtils] Fetch response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error details");
      console.error(
        "[headerUtils] Failed to load partial. Status:",
        response.status
      );
      console.error("[headerUtils] Error response:", errorText);
      throw new Error(
        `Failed to load partial: ${partialName} (${response.status} ${response.statusText})`
      );
    }

    const html = await response.text();
    console.log(
      "[headerUtils] Partial HTML received, length:",
      html.length,
      "chars"
    );
    // Cache the result
    partialCache[partialName] = html.trim();
    return partialCache[partialName];
  } catch (error) {
    console.error(`[headerUtils] Error loading partial ${partialName}:`, error);
    console.error("[headerUtils] Error details:", error.message);
    console.error("[headerUtils] Error stack:", error.stack);
    throw error;
  }
}

// Logout function - uses authService and router
async function logout() {
  // Set a flag to prevent any auth checks during logout (persist in sessionStorage)
  window.__isLoggingOut = true;
  sessionStorage.setItem("__isLoggingOut", "true");

  try {
    // Clear token immediately to prevent any auth checks from passing
    if (window.authService) {
      // Clear token first, then make logout request
      window.authService.setToken(null);
      window.authService.currentUser = null;
      // Make logout request (but don't wait for it - clear local state first)
      window.authService.logout().catch((err) => {
        console.error("Logout API error (non-critical):", err);
      });
    }
    // Use replace instead of href to avoid history issues
    // Small delay to ensure localStorage is cleared before redirect
    setTimeout(() => {
      window.location.replace("/");
    }, 50);
  } catch (error) {
    console.error("Logout error:", error);
    // Clear token even on error
    if (window.authService) {
      window.authService.setToken(null);
      window.authService.currentUser = null;
    }
    window.location.replace("/");
  }
}

/**
 * Initialize the logged-out header
 * Simple header with Login and Sign Up links
 * Fetches the header partial from /partials/logged-out-header.html
 */
async function initLoggedOutHeader() {
  // Make available on window immediately when function is called
  if (typeof window !== "undefined" && !window.initLoggedOutHeader) {
    window.initLoggedOutHeader = initLoggedOutHeader;
  }
  try {
    const html = await fetchPartial("logged-out-header.html");

    // Find or create header container
    const existingHeader = document.querySelector("header.header");
    if (existingHeader) {
      existingHeader.outerHTML = html;
    } else {
      // If no header exists, prepend to body
      document.body.insertAdjacentHTML("afterbegin", html);
    }
  } catch (error) {
    console.error("Failed to initialize logged-out header:", error);
    // Fallback: create a basic header if fetch fails
    const existingHeader = document.querySelector("header.header");
    const fallbackHtml =
      '<header class="header"><div class="header-content"><a href="/" class="logo">DJ Clownfish</a><nav class="header-nav"><a href="/login" class="header-btn">Login</a><a href="/signup" class="header-btn header-btn-primary">Sign Up</a></nav></div></header>';
    if (existingHeader) {
      existingHeader.outerHTML = fallbackHtml;
    } else {
      document.body.insertAdjacentHTML("afterbegin", fallbackHtml);
    }
  }
}

/**
 * Initialize the logged-in header
 * @param {Array<string>} additionalLinks - Array of link objects with {href, text} or just text strings for simple links
 * Example: [{href: '/dashboard', text: 'Dashboard'}, {href: '/admin', text: 'Admin'}]
 * Or simple: ['Dashboard', 'Admin'] for auto-generating links (will use route-based URLs)
 * Fetches the header partial from /partials/logged-in-header.html
 */
async function initLoggedInHeader(additionalLinks = []) {
  console.log(
    "[headerUtils] initLoggedInHeader called with links:",
    additionalLinks
  );
  // Make available on window immediately when function is called
  if (typeof window !== "undefined" && !window.initLoggedInHeader) {
    window.initLoggedInHeader = initLoggedInHeader;
  }
  try {
    console.log("[headerUtils] Fetching logged-in-header.html partial...");
    const html = await fetchPartial("logged-in-header.html");
    console.log("[headerUtils] Partial fetched, length:", html.length);

    // Find or create header container
    const existingHeader = document.querySelector("header.header");
    if (existingHeader) {
      existingHeader.outerHTML = html;
    } else {
      // If no header exists, prepend to body
      document.body.insertAdjacentHTML("afterbegin", html);
    }
  } catch (error) {
    console.error("Failed to initialize logged-in header:", error);
    // Fallback: create a basic header if fetch fails
    const existingHeader = document.querySelector("header.header");
    const fallbackHtml =
      '<header class="header"><div class="header-content"><a href="/" class="logo">DJ Clownfish</a><nav class="header-nav" id="header-nav"><span id="user-email" class="user-email"></span><button id="logout-btn" class="header-btn">Logout</button></nav></div></header>';
    if (existingHeader) {
      existingHeader.outerHTML = fallbackHtml;
    } else {
      document.body.insertAdjacentHTML("afterbegin", fallbackHtml);
    }
  }

  // Wait for DOM to update
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Add additional navigation links if provided
  const headerNav = document.getElementById("header-nav");
  let profileElement = null; // Track Profile element for Spotify button insertion

  if (headerNav && additionalLinks.length > 0) {
    const userEmailSpan = document.getElementById("user-email");

    // Insert links before user email
    additionalLinks.forEach((link) => {
      let href, text, onClick, isButton, className;
      if (typeof link === "string") {
        // Simple string format - generate href from text (route-based, not .html)
        text = link;
        href = "/" + text.toLowerCase().replace(/\s+/g, "-");
      } else {
        // Object format
        href = link.href || "#";
        text = link.text;
        onClick = link.onClick;
        isButton = link.isButton || false;
        className = link.className || "";
      }

      let element;
      if (isButton || onClick) {
        // Create button element
        element = document.createElement("button");
        element.type = "button";
        element.className = "header-btn" + (className ? " " + className : "");
        element.textContent = text;
        if (onClick) {
          element.addEventListener("click", onClick);
        }
      } else {
        // Create anchor element
        element = document.createElement("a");
        element.href = href;
        element.className = "header-btn" + (className ? " " + className : "");
        element.textContent = text;
      }

      headerNav.insertBefore(element, userEmailSpan);

      // Track Profile element for Spotify button insertion
      if (text === "Profile" || href.includes("profile")) {
        profileElement = element;
      }
    });
  }

  // Setup logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Get user info and display email using authService
  if (window.authService) {
    const user = window.authService.getCurrentUser();
    const userEmail = document.getElementById("user-email");
    if (user && userEmail) {
      userEmail.textContent = user.email || "";
    } else {
      // Try to refresh user info
      const isAuth = await window.authService.isAuthenticated();
      if (isAuth) {
        const refreshedUser = window.authService.getCurrentUser();
        if (refreshedUser && userEmail) {
          userEmail.textContent = refreshedUser.email || "";
        }
      }
    }
  }

  // Add Spotify OAuth button next to Profile button
  // Use a small delay to ensure DOM is fully ready
  setTimeout(() => {
    const headerNavForSpotify = document.getElementById("header-nav");
    if (headerNavForSpotify && !document.getElementById("spotify-oauth-btn")) {
      // Try to find Profile link - use tracked element first, then search
      let profileLink = profileElement;
      if (!profileLink && headerNavForSpotify) {
        // Search through all children of headerNav (more robust search)
        profileLink = Array.from(headerNavForSpotify.children).find((el) => {
          const href = el.href || "";
          const text = (el.textContent || "").trim().toLowerCase();
          return (
            (el.tagName === "A" &&
              (href.toLowerCase().includes("profile") || text === "profile")) ||
            (el.tagName === "BUTTON" && text === "profile")
          );
        });
      }

      const spotifyBtn = document.createElement("button");
      spotifyBtn.id = "spotify-oauth-btn";
      spotifyBtn.type = "button";
      spotifyBtn.className = "header-btn spotify-btn";
      spotifyBtn.textContent = "🎵 Connect Spotify";
      spotifyBtn.style.cursor = "pointer";
      spotifyBtn.addEventListener("click", async function () {
        // Make authenticated request to get OAuth URL, then redirect
        try {
          const token = window.authService ? window.authService.getToken() : localStorage.getItem('token');
          if (!token) {
            alert('Please log in to connect Spotify');
            return;
          }
          
          const response = await fetch(BACKEND_URL + "/api/v1/spotify/auth?format=json", {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.authUrl) {
              window.location.href = data.data.authUrl;
            } else {
              alert('Failed to initiate Spotify connection');
            }
          } else {
            alert('Authentication required. Please log in again.');
          }
        } catch (error) {
          console.error('Error initiating Spotify OAuth:', error);
          alert('Failed to connect to Spotify. Please try again.');
        }
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
        const userEmailSpan = document.getElementById("user-email");
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

// Make functions available globally for module access IMMEDIATELY
// This must be done synchronously before modules execute
(function () {
  console.log("[headerUtils] Setting up window properties...");
  if (typeof window !== "undefined") {
    window.initLoggedInHeader = initLoggedInHeader;
    window.initLoggedOutHeader = initLoggedOutHeader;
    window.logout = logout;
    // Signal that headerUtils is ready
    window.__headerUtilsReady = true;
    console.log(
      "[headerUtils] Window properties set. initLoggedInHeader type:",
      typeof window.initLoggedInHeader
    );
    // Dispatch event for modules that might be waiting
    if (typeof document !== "undefined") {
      document.dispatchEvent(new Event("headerUtilsReady"));
      console.log("[headerUtils] Dispatched headerUtilsReady event");
    }
  } else {
    console.error("[headerUtils] window is undefined!");
  }
})();
