/**
 * Centralized authentication service
 * Uses JWT tokens stored in localStorage for authentication
 */
class AuthService {
  constructor() {
    this.currentUser = null;
    this.backendUrl = window.getBackendUrl();
    // Ensure we can read from localStorage immediately
    this._token = null;
    this._loadTokenFromStorage();
  }

  /**
   * Load token from localStorage
   * @private
   */
  _loadTokenFromStorage() {
    try {
      this._token = localStorage.getItem('token');
    } catch (err) {
      console.error('Failed to read token from localStorage:', err);
      this._token = null;
    }
  }

  /**
   * Get token from localStorage
   * @returns {string|null}
   */
  getToken() {
    // Always read fresh from localStorage to ensure we have the latest value
    try {
      const token = localStorage.getItem('token');
      this._token = token;
      return token;
    } catch (err) {
      console.error('Failed to read token from localStorage:', err);
      return this._token;
    }
  }

  /**
   * Set token in localStorage and cookie
   * @param {string} token
   */
  setToken(token) {
    try {
      if (token) {
        localStorage.setItem('token', token);
        this._token = token;
        // Also set cookie so server can see it
        // Use secure cookie if on HTTPS, otherwise regular cookie
        const isSecure = window.location.protocol === 'https:';
        const cookieOptions = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
        document.cookie = cookieOptions;
        console.log('[authService] Token stored successfully (localStorage + cookie)');
      } else {
        localStorage.removeItem('token');
        this._token = null;
        // Clear cookie
        document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
        console.log('[authService] Token cleared (localStorage + cookie)');
      }
    } catch (err) {
      console.error('[authService] Failed to store token:', err);
      // Still update internal state even if storage fails
      this._token = token || null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    // If we're in the process of logging out, return false immediately
    const isLoggingOut = window.__isLoggingOut || sessionStorage.getItem('__isLoggingOut') === 'true';
    if (isLoggingOut) {
      console.log('[authService] Logging out, skipping auth check');
      this.currentUser = null;
      return false;
    }
    
    const token = this.getToken();
    console.log('[authService] isAuthenticated check - token present:', !!token);
    if (!token) {
      console.log('[authService] No token found');
      this.currentUser = null;
      return false;
    }

    try {
      console.log('[authService] Verifying token with backend...');
      const response = await fetch(`${this.backendUrl}/api/v1/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors',
      });

      console.log('[authService] Profile response status:', response.status);

      if (response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Expected JSON but got ${contentType || 'unknown type'}: ${text.substring(0, 100)}`);
        }
        if (data.success && data.data) {
          this.currentUser = data.data;
          console.log('[authService] Authentication verified, user:', data.data.email);
          return true;
        } else {
          console.log('[authService] Profile response not successful:', data);
        }
      }
      
      // If request failed, token might be invalid - clear it
      if (response.status === 401 || response.status === 403) {
        console.log('[authService] Token invalid (401/403), clearing token');
        this.setToken(null);
      } else {
        console.log('[authService] Profile check failed with status:', response.status);
      }
      
      this.currentUser = null;
      return false;
    } catch (error) {
      console.error('[authService] Error checking authentication:', error);
      // Don't clear token on network errors - might be temporary
      // Only clear token if it's definitely invalid
      this.currentUser = null;
      return false;
    }
  }

  /**
   * Get current user
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message: string, user?: Object}>}
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType || 'unknown type'}: ${text.substring(0, 100)}`);
      }

      if (response.ok && data.success) {
        const token = data.data?.token;
        console.log('[authService] Login response - token present:', !!token);
        if (token) {
          this.setToken(token);
          // Verify it was stored
          const storedToken = this.getToken();
          console.log('[authService] Token stored and verified:', !!storedToken);
          if (!storedToken) {
            console.error('[authService] Token storage verification failed!');
          }
        } else {
          console.error('[authService] No token in login response:', data);
        }
        this.currentUser = data.data.user;
        return {
          success: true,
          message: data.message || 'Login successful',
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Login failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Network error: ' + error.message,
      };
    }
  }

  /**
   * Signup user
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message: string, user?: Object}>}
   */
  async signup(name, email, password) {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password,
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType || 'unknown type'}: ${text.substring(0, 100)}`);
      }

      if (response.ok && data.success) {
        const token = data.data?.token;
        if (token) {
          this.setToken(token);
        }
        this.currentUser = data.data.user;
        return {
          success: true,
          message: data.message || 'Account created successfully',
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Signup failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Network error: ' + error.message,
      };
    }
  }

  /**
   * Logout user
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async logout() {
    try {
      const token = this.getToken();
      const response = await fetch(`${this.backendUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        mode: 'cors',
      });

      this.setToken(null);
      this.currentUser = null;

      if (response.ok) {
        return {
          success: true,
          message: 'Logged out successfully',
        };
      } else {
        return {
          success: false,
          message: 'Logout failed',
        };
      }
    } catch (error) {
      this.setToken(null);
      this.currentUser = null;
      return {
        success: false,
        message: 'Network error: ' + error.message,
      };
    }
  }

  /**
   * Make authenticated API request
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  async apiRequest(url, options = {}) {
    const token = this.getToken();
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(options.headers || {}),
      },
      mode: 'cors',
      ...options,
    };

    return fetch(`${this.backendUrl}${url}`, defaultOptions);
  }
}

// Export auth service instance
window.authService = new AuthService();

