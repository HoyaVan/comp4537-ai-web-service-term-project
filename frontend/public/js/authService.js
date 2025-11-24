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
    const profileUrl = `${this.backendUrl}/api/auth/profile`;
    console.log('[AUTH_SERVICE] Checking authentication status');
    console.log('[AUTH_SERVICE] Profile URL:', profileUrl);
    console.log('[AUTH_SERVICE] Request method: GET');
    console.log('[AUTH_SERVICE] Credentials: include (cookies will be sent)');
    
    try {
      const checkStartTime = Date.now();
      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include', // Include cookies
        mode: 'cors',
      });

      const checkDuration = Date.now() - checkStartTime;
      console.log(`[AUTH_SERVICE] Profile check completed in ${checkDuration}ms`);
      console.log('[AUTH_SERVICE] Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[AUTH_SERVICE] Profile response data:', {
          success: data.success,
          hasData: !!data.data,
          userEmail: data.data?.email,
          userRole: data.data?.role
        });
        
        if (data.success && data.data) {
          console.log('[AUTH_SERVICE] Authentication verified - user is authenticated');
          this.currentUser = data.data;
          return true;
        } else {
          console.log('[AUTH_SERVICE] Authentication failed - response.success is false or no user data');
        }
      } else {
        console.log('[AUTH_SERVICE] Authentication failed - response not OK (status:', response.status, ')');
      }
      
      this.currentUser = null;
      return false;
    } catch (error) {
      console.error('[AUTH_SERVICE] Auth check failed with error:', error);
      console.error('[AUTH_SERVICE] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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
    const loginUrl = `${this.backendUrl}/api/auth/login`;
    console.log('[AUTH_SERVICE] Login request initiated');
    console.log('[AUTH_SERVICE] Request URL:', loginUrl);
    console.log('[AUTH_SERVICE] Request method: POST');
    console.log('[AUTH_SERVICE] Credentials: include (cookies will be sent)');
    console.log('[AUTH_SERVICE] Mode: cors');
    
    try {
      const requestStartTime = Date.now();
      const response = await fetch(loginUrl, {
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

      const requestDuration = Date.now() - requestStartTime;
      console.log(`[AUTH_SERVICE] Fetch completed in ${requestDuration}ms`);
      console.log('[AUTH_SERVICE] Response status:', response.status, response.statusText);
      console.log('[AUTH_SERVICE] Response headers:', {
        'content-type': response.headers.get('content-type'),
        'set-cookie': response.headers.get('set-cookie') ? 'present' : 'missing'
      });

      const data = await response.json();
      console.log('[AUTH_SERVICE] Response data parsed:', {
        success: data.success,
        hasData: !!data.data,
        hasUser: !!(data.data && data.data.user),
        message: data.message
      });

      if (response.ok && data.success) {
        console.log('[AUTH_SERVICE] Login successful, storing user data');
        this.currentUser = data.data.user;
        console.log('[AUTH_SERVICE] Current user stored:', {
          id: this.currentUser?.id,
          email: this.currentUser?.email,
          role: this.currentUser?.role
        });
        return {
          success: true,
          message: data.message || 'Login successful',
          user: data.data.user,
        };
      } else {
        console.log('[AUTH_SERVICE] Login failed - response not OK or success=false');
        console.log('[AUTH_SERVICE] Failure reason:', data.message || 'Unknown');
        return {
          success: false,
          message: data.message || 'Login failed',
        };
      }
    } catch (error) {
      console.error('[AUTH_SERVICE] Network error during login:', error);
      console.error('[AUTH_SERVICE] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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

