/**
 * Centralized authentication service
 * Uses JWT tokens stored in localStorage for authentication
 */
class AuthService {
  constructor() {
    this.currentUser = null;
    this.backendUrl = window.getBackendUrl();
  }

  /**
   * Get token from localStorage
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Set token in localStorage
   * @param {string} token
   */
  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
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
      this.currentUser = null;
      return false;
    }
    
    const token = this.getToken();
    if (!token) {
      this.currentUser = null;
      return false;
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          this.currentUser = data.data;
          return true;
        }
      }
      
      // If request failed, token might be invalid - clear it
      if (response.status === 401 || response.status === 403) {
        this.setToken(null);
      }
      
      this.currentUser = null;
      return false;
    } catch (error) {
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
      const response = await fetch(`${this.backendUrl}/api/auth/login`, {
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

      const data = await response.json();

      if (response.ok && data.success) {
        const token = data.data?.token;
        if (token) {
          this.setToken(token);
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
      const response = await fetch(`${this.backendUrl}/api/auth/signup`, {
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

      const data = await response.json();

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
      const response = await fetch(`${this.backendUrl}/api/auth/logout`, {
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

