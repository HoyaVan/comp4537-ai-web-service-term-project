/**
 * API Tracking Middleware
 * 
 * Tracks API calls for:
 * 1. Per-user API consumption (unlimited calls)
 * 2. Per-endpoint statistics (for admin dashboard)
 * 
 * This middleware should be applied to all API routes.
 * 
 * Attribution: Created with assistance from ChatGPT
 */

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
 */
const trackApiCall = (method, endpoint, userId, statusCode, responseTime) => {
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
  
  // Update user API count (only for authenticated users and successful calls)
  if (userId && userId !== 'anonymous' && statusCode >= 200 && statusCode < 300) {
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
 */
const apiTrackingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const method = req.method;
  
  // Track response when it finishes
  // Note: We capture userId and endpoint here (after auth middleware may have run) to get the actual user
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode || 200;
    
    // Capture userId at response time (after authentication middleware has run)
    const userId = req.userId || req.user?.id || null;
    
    // Capture endpoint - use route path if available (more accurate), otherwise use request path
    // req.route?.path gives the route pattern (e.g., "/api/auth/profile")
    // req.path gives the actual path (e.g., "/api/auth/profile")
    // req.url gives full URL with query string
    const endpoint = req.route?.path || req.path || req.url.split('?')[0];
    
    trackApiCall(method, endpoint, userId, statusCode, responseTime);
  });
  
  next();
};



module.exports = {
  apiTrackingMiddleware,
  getUserApiCount,
  getEndpointStats,
  getUserConsumptionStats,
  getAllApiLogs,
  resetUserApiCount,
};

