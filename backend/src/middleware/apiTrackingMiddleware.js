/**
 * API Tracking Middleware
 * 
 * Tracks API calls for:
 * 1. Per-user API consumption (for 30 free calls limit)
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

// Free API calls limit per user
const FREE_API_CALLS_LIMIT = 30;

/**
 * Get API call count for a user
 * @param {string} userId - User ID
 * @returns {number} Number of API calls made by user
 */
const getUserApiCount = (userId) => {
  return userApiCounts.get(userId) || 0;
};

/**
 * Check if user has exceeded free API calls
 * @param {string} userId - User ID
 * @returns {boolean} True if user has exceeded limit
 */
const hasExceededLimit = (userId) => {
  return getUserApiCount(userId) >= FREE_API_CALLS_LIMIT;
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
  }
  
  // Log to console
  const userDisplay = userId && userId !== 'anonymous' ? `User: ${userId}` : 'User: anonymous';
  console.log(
    `[API Tracker] ${method} ${endpoint} - ${userDisplay} - Status: ${statusCode} - Time: ${responseTime}ms`
  );
};

/**
 * Get endpoint statistics
 * @returns {Array} Array of endpoint stats
 */
const getEndpointStats = () => {
  const stats = [];
  for (const [endpointKey, count] of endpointStats) {
    const [method, endpoint] = endpointKey.split(' ', 2);
    stats.push({
      method,
      endpoint,
      requests: count,
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
 * Get API call logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs to return
 * @returns {Array} Array of API call logs
 */
const getUserApiLogs = (userId, limit = 100) => {
  return apiCallLogs
    .filter(log => log.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
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
  const endpoint = req.path || req.route?.path || req.url;
  const userId = req.userId || req.user?.id || null;
  
  // Track response when it finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode || 200;
    trackApiCall(method, endpoint, userId, statusCode, responseTime);
  });
  
  next();
};

/**
 * Middleware to check API call limit
 * Should be used after authentication middleware
 * Returns 429 if user has exceeded free API calls
 */
const checkApiLimitMiddleware = (req, res, next) => {
  const userId = req.userId || req.user?.id;
  
  // Skip limit check for anonymous users or if no user ID
  if (!userId) {
    return next();
  }
  
  // Skip limit check for admin users
  if (req.user?.role === 'admin') {
    return next();
  }
  
  // Check if user has exceeded limit
  if (hasExceededLimit(userId)) {
    return res.status(429).json({
      success: false,
      message: 'You have exceeded your free API call limit (30 calls). Please contact support for more information.',
      apiCallsUsed: getUserApiCount(userId),
      apiCallsLimit: FREE_API_CALLS_LIMIT,
    });
  }
  
  next();
};

module.exports = {
  apiTrackingMiddleware,
  checkApiLimitMiddleware,
  getUserApiCount,
  hasExceededLimit,
  getEndpointStats,
  getUserConsumptionStats,
  getUserApiLogs,
  getAllApiLogs,
  resetUserApiCount,
  FREE_API_CALLS_LIMIT,
};

