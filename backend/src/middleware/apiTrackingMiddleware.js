const apiTrackingMessages = require("../messages/apiTracking");

/**
 * API Tracking Middleware
 * 
 * Tracks API calls for:
 * 1. Per-user API consumption (20 free calls per user)
 * 2. Per-endpoint statistics (for admin dashboard)
 * 
 * This middleware should be applied to all API routes.
 * 
 * Attribution: Created with assistance from ChatGPT
 */

// Free API calls limit per user
const FREE_API_CALLS_LIMIT = 20;

// In-memory storage (replace with database in production)
const apiCallLogs = [];
const userApiCounts = new Map(); // userId -> count
const endpointStats = new Map(); // "METHOD /endpoint" -> count
const endpointUserStats = new Map(); // "METHOD /endpoint" -> Map<userId, count>
const endpointLastCall = new Map(); // "METHOD /endpoint" -> { userId, timestamp }

/**
 * Get API call count for a user
 * @param {string} userId - User ID
 * @returns {number} Number of API calls made by user
 */
const getUserApiCount = (userId) => {
  return userApiCounts.get(userId) || 0;
};

/**
 * Check if user has exceeded free API calls limit
 * @param {string} userId - User ID
 * @param {string} userRole - User role (optional)
 * @returns {boolean} True if user has exceeded limit
 */
const hasExceededLimit = (userId, userRole = null) => {
  if (!userId || userId === 'anonymous') {
    return false; // Anonymous users don't have limits
  }
  if (userRole === 'admin') {
    return false; // Admin users don't have limits
  }
  const count = getUserApiCount(userId);
  return count >= FREE_API_CALLS_LIMIT;
};

/**
 * Get remaining free API calls for a user
 * @param {string} userId - User ID
 * @param {string} userRole - User role (optional)
 * @returns {number|null} Remaining calls (null for unlimited, 0 if exceeded)
 */
const getRemainingCalls = (userId, userRole = null) => {
  if (!userId || userId === 'anonymous') {
    return null; // Anonymous users don't have limits
  }
  if (userRole === 'admin') {
    return null; // Admin users have unlimited calls
  }
  const count = getUserApiCount(userId);
  const remaining = Math.max(0, FREE_API_CALLS_LIMIT - count);
  return remaining;
};



/**
 * Increment API call count for a user
 * @param {string} userId - User ID
 */
const incrementUserApiCount = (userId) => {
  const currentCount = getUserApiCount(userId);
  userApiCounts.set(userId, currentCount + 1);
};

/**
 * Track API call statistics
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint path
 * @param {string} userId - User ID (or 'anonymous' if not authenticated)
 * @param {number} statusCode - HTTP status code
 * @param {number} responseTime - Response time in milliseconds
 * @param {string} userRole - User role (optional, to exclude admin users from counting)
 */
const trackApiCall = (method, endpoint, userId, statusCode, responseTime, userRole = null) => {
  const timestamp = new Date().toISOString();
  
  // Create log entry
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
    method,
    endpoint,
    userId: userId || 'anonymous',
    statusCode,
    responseTime,
    timestamp,
  };
  
  // Store log entry
  apiCallLogs.push(logEntry);
  
  // Check if this is an auth endpoint (should not count towards limit)
  // Check both full path (/api/auth/profile) and route path (/profile)
  const isAuthEndpoint = endpoint.includes('/api/auth/login') || 
                         endpoint.includes('/api/auth/signup') || 
                         endpoint.includes('/api/auth/profile') ||
                         endpoint === '/profile' ||
                         endpoint === '/login' ||
                         endpoint === '/signup';
  
  // Check if user is admin (admins don't have API call limits)
  const isAdmin = userRole === 'admin';
  
  // Update user API count (only for authenticated users, successful calls, non-auth endpoints, and non-admin users)
  if (userId && userId !== 'anonymous' && statusCode >= 200 && statusCode < 300 && !isAuthEndpoint && !isAdmin) {
    incrementUserApiCount(userId);
  }
  
  // Update endpoint statistics (only for successful calls)
  if (statusCode >= 200 && statusCode < 300) {
    const endpointKey = `${method} ${endpoint}`;
    const currentCount = endpointStats.get(endpointKey) || 0;
    endpointStats.set(endpointKey, currentCount + 1);
    
    // Track latest call for this endpoint
    endpointLastCall.set(endpointKey, {
      userId: userId || 'anonymous',
      timestamp: timestamp,
    });
    
    // Track which users called this endpoint
    if (userId && userId !== 'anonymous') {
      if (!endpointUserStats.has(endpointKey)) {
        endpointUserStats.set(endpointKey, new Map());
      }
      const userStats = endpointUserStats.get(endpointKey);
      const userCount = userStats.get(userId) || 0;
      userStats.set(userId, userCount + 1);
    }
  }
  
  // Log to console
  const userDisplay = userId && userId !== 'anonymous' ? `User: ${userId}` : 'User: anonymous';
  console.log(
    `[API Tracker] ${method} ${endpoint} - ${userDisplay} - Status: ${statusCode} - Time: ${responseTime}ms`
  );
};

/**
 * Get endpoint statistics with user information
 * @returns {Array} Array of endpoint stats with user details
 */
const getEndpointStats = () => {
  const stats = [];
  for (const [endpointKey, count] of endpointStats) {
    const [method, endpoint] = endpointKey.split(' ', 2);
    const userStats = endpointUserStats.get(endpointKey) || new Map();
    
    // Get user IDs who called this endpoint
    const users = [];
    for (const [userId, userCount] of userStats) {
      users.push({
        userId,
        count: userCount,
      });
    }
    
    // Get latest call info
    const lastCall = endpointLastCall.get(endpointKey) || null;
    
    stats.push({
      method,
      endpoint,
      requests: count,
      users: users.sort((a, b) => b.count - a.count), // Sort by count descending
      lastCall: lastCall ? {
        userId: lastCall.userId,
        timestamp: lastCall.timestamp,
      } : null,
    });
  }
  const sortedStats = [...stats];
  sortedStats.sort((a, b) => b.requests - a.requests);
  return sortedStats;
};

/**
 * Get user API consumption statistics
 * @returns {Array} Array of user consumption stats
 */
const getUserConsumptionStats = () => {
  const stats = [];
  for (const [userId, count] of userApiCounts) {
    stats.push({
      userId,
      totalRequests: count,
    });
  }
  const sortedStats = [...stats];
  sortedStats.sort((a, b) => b.totalRequests - a.totalRequests);
  return sortedStats;
};

/**
 * Get per-endpoint API consumption for a specific user
 * @param {string} userId - User ID
 * @returns {Array} Array of endpoint stats for the user
 */
const getUserEndpointStats = (userId) => {
  const userEndpointStats = [];
  
  for (const [endpointKey, userStats] of endpointUserStats) {
    const userCount = userStats.get(userId);
    if (userCount && userCount > 0) {
      const [method, endpoint] = endpointKey.split(' ', 2);
      userEndpointStats.push({
        method,
        endpoint,
        requests: userCount,
      });
    }
  }
  
  // Sort by request count descending
  userEndpointStats.sort((a, b) => b.requests - a.requests);
  return userEndpointStats;
};


/**
 * Get all API call logs (admin only)
 * @param {number} limit - Maximum number of logs to return
 * @returns {Array} Array of API call logs
 */
const getAllApiLogs = (limit = 1000) => {
  const sortedLogs = [...apiCallLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return sortedLogs.slice(0, limit);
};

/**
 * Reset API call count for a user (admin function)
 * @param {string} userId - User ID
 */
const resetUserApiCount = (userId) => {
  userApiCounts.set(userId, 0);
};

/**
 * API Tracking Middleware
 * Tracks all API calls and logs them
 * Adds warning headers when user exceeds free API calls limit
 */
const apiTrackingMiddleware = (req, res, next) => {
  // Prevent double counting by checking if we've already tracked this request
  if (req._apiTracked) {
    return next();
  }
  req._apiTracked = true;
  
  const startTime = Date.now();
  const method = req.method;
  
  // Track response when it finishes
  // Note: We capture userId and endpoint here (after auth middleware may have run) to get the actual user
  res.on('finish', () => {
    // Prevent double counting if finish event fires multiple times
    if (req._apiTrackedFinished) {
      return;
    }
    req._apiTrackedFinished = true;
    
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode || 200;
    
    // Capture userId and user role at response time (after authentication middleware has run)
    const finalUserId = req.userId || req.user?.id || null;
    const userRole = req.user?.role || null;
    
    // Capture endpoint - use request path (full path including mount point)
    // req.path gives the actual path (e.g., "/api/auth/profile")
    // req.route?.path gives only the route pattern (e.g., "/profile") without mount point
    // req.url gives full URL with query string
    // We use req.path to get the full path including the mount point
    // Also check req.baseUrl + req.route?.path for more accurate route matching
    let endpoint = req.path;
    if (req.baseUrl && req.route?.path) {
      // Combine baseUrl (mount point) with route path for accurate endpoint
      endpoint = req.baseUrl + req.route.path;
    } else if (!endpoint && req.url) {
      endpoint = req.url.split('?')[0];
    }
    
    // Track the API call (pass userRole to exclude admin users from counting)
    trackApiCall(method, endpoint, finalUserId, statusCode, responseTime, userRole);
    
    // Check if this is an auth endpoint (should not show warning)
    // Check both full path (/api/auth/profile) and route path (/profile)
    const isAuthEndpoint = endpoint.includes('/api/auth/login') || 
                           endpoint.includes('/api/auth/signup') || 
                           endpoint.includes('/api/auth/profile') ||
                           endpoint === '/profile' ||
                           endpoint === '/login' ||
                           endpoint === '/signup';
    
    // Add warning header if user has exceeded limit (only for authenticated users, successful calls, non-auth endpoints, and non-admin users)
    if (finalUserId && finalUserId !== 'anonymous' && 
        statusCode >= 200 && statusCode < 300 &&
        !isAuthEndpoint &&
        userRole !== 'admin') {
      const exceeded = hasExceededLimit(finalUserId, userRole);
      if (exceeded) {
        res.setHeader('X-API-Limit-Exceeded', 'true');
        res.setHeader('X-API-Limit-Message', apiTrackingMessages.apiLimitExceededMessage(FREE_API_CALLS_LIMIT));
      }
    }
  });
  
  next();
};



module.exports = {
  apiTrackingMiddleware,
  getUserApiCount,
  getEndpointStats,
  getUserConsumptionStats,
  getUserEndpointStats,
  getAllApiLogs,
  resetUserApiCount,
  hasExceededLimit,
  getRemainingCalls,
  FREE_API_CALLS_LIMIT,
};

