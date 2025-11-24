/**
 * Centralized authentication service
 * Uses httpOnly cookies for authentication
 */
class AuthService {
  constructor() {
    this.currentUser = null;
    this.backendUrl = window.getBackendUrl();
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const response = await fetch(`${this.backendUrl}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include', // Include cookies
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          this.currentUser = data.data;
          return true;
        }
      }
      this.currentUser = null;
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
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
        credentials: 'include', // Include cookies
        mode: 'cors',
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
        credentials: 'include', // Include cookies
        mode: 'cors',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
      const response = await fetch(`${this.backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include', // Include cookies
        mode: 'cors',
      });

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
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include', // Always include cookies
      mode: 'cors',
      ...options,
    };

    return fetch(`${this.backendUrl}${url}`, defaultOptions);
  }
}

// Export auth service instance
window.authService = new AuthService();

