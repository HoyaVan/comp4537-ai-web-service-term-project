const apiTrackingMessages = require("../messages/apiTracking");
const db = require("../utils/db");

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

// In-memory storage for endpoint stats and logs (not stored in database)
const apiCallLogs = [];
const endpointStats = new Map(); // "METHOD /endpoint" -> count
const endpointUserStats = new Map(); // "METHOD /endpoint" -> Map<userId, count>
const endpointLastCall = new Map(); // "METHOD /endpoint" -> { userId, timestamp }

/**
 * Parse and validate user ID for API tracking
 * @param {string} userId - User ID to parse
 * @returns {number|null} Parsed user ID or null if invalid/anonymous
 */
function parseUserIdForTracking(userId) {
  if (!userId || userId === "anonymous") {
    return null;
  }
  const userIdInt = parseInt(userId, 10);
  return isNaN(userIdInt) ? null : userIdInt;
}

/**
 * Get API call count for a user from database
 * @param {number} userIdInt - User ID (integer)
 * @returns {Promise<number>} Number of API calls made by user
 */
async function getUserApiCallsFromDb(userIdInt) {
  try {
    const users = await db.query(
      "SELECT api_calls FROM `user` WHERE user_id = ?",
      [userIdInt]
    );
    return users.length > 0 ? users[0].api_calls || 0 : 0;
  } catch (error) {
    console.error("Error getting user API count:", error);
    return 0;
  }
}

/**
 * Get API call count for a user from database
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of API calls made by user
 */
const getUserApiCount = async (userId) => {
  const userIdInt = parseUserIdForTracking(userId);
  if (!userIdInt) {
    return 0;
  }
  return await getUserApiCallsFromDb(userIdInt);
};

/**
 * Check if user has exceeded free API calls limit
 * @param {string} userId - User ID
 * @param {string} userRole - User role (optional)
 * @returns {Promise<boolean>} True if user has exceeded limit
 */
const hasExceededLimit = async (userId, userRole = null) => {
  if (!userId || userId === "anonymous") {
    return false; // Anonymous users don't have limits
  }
  if (userRole === "admin") {
    return false; // Admin users don't have limits
  }
  const count = await getUserApiCount(userId);
  return count >= FREE_API_CALLS_LIMIT;
};

/**
 * Get remaining free API calls for a user
 * @param {string} userId - User ID
 * @param {string} userRole - User role (optional)
 * @returns {Promise<number|null>} Remaining calls (null for unlimited, 0 if exceeded)
 */
const getRemainingCalls = async (userId, userRole = null) => {
  if (!userId || userId === "anonymous") {
    return null; // Anonymous users don't have limits
  }
  if (userRole === "admin") {
    return null; // Admin users have unlimited calls
  }
  const count = await getUserApiCount(userId);
  const remaining = Math.max(0, FREE_API_CALLS_LIMIT - count);
  return remaining;
};

/**
 * Update API call count for a user in database
 * @param {number} userIdInt - User ID (integer)
 * @param {number} increment - Amount to increment (can be negative)
 * @returns {Promise<number>} New API call count
 */
async function updateUserApiCallsInDb(userIdInt, increment) {
  try {
    await db.query(
      "UPDATE `user` SET api_calls = api_calls + ? WHERE user_id = ?",
      [increment, userIdInt]
    );

    // Get updated count for logging
    const newCount = await getUserApiCallsFromDb(userIdInt);
    return newCount;
  } catch (error) {
    console.error("Error updating user API count:", error);
    throw error;
  }
}

/**
 * Increment API call count for a user in database
 * @param {string} userId - User ID
 */
const incrementUserApiCount = async (userId) => {
  const userIdInt = parseUserIdForTracking(userId);
  if (!userIdInt) {
    return;
  }

  try {
    const newCount = await updateUserApiCallsInDb(userIdInt, 1);
    console.log(
      `[API Tracker] Incremented API count for user ${userId}: ${newCount}`
    );
  } catch (error) {
    console.error("Error incrementing user API count:", error);
  }
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
const trackApiCall = (
  method,
  endpoint,
  userId,
  statusCode,
  responseTime,
  userRole = null
) => {
  const timestamp = new Date().toISOString();

  // Create log entry
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
    method,
    endpoint,
    userId: userId || "anonymous",
    statusCode,
    responseTime,
    timestamp,
  };

  // Store log entry
  apiCallLogs.push(logEntry);

  // Check if this is an auth endpoint (should not count towards limit)
  // Auth routes are mounted at /api/v1/auth, so full paths are /api/v1/auth/login, /api/v1/auth/signup, /api/v1/auth/profile
  // Also check route paths (/login, /signup, /profile) in case endpoint is captured differently
  // /api/v1/auth/users is an admin-only endpoint for listing users, should not be tracked
  const isAuthEndpoint =
    endpoint.includes("/api/v1/auth/login") ||
    endpoint.includes("/api/v1/auth/signup") ||
    endpoint.includes("/api/v1/auth/profile") ||
    endpoint.includes("/api/v1/auth/users") ||
    endpoint === "/login" ||
    endpoint === "/signup" ||
    endpoint === "/profile" ||
    endpoint === "/users" ||
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/signup") ||
    endpoint.includes("/auth/profile") ||
    endpoint.includes("/auth/users");

  // Check if this is an admin stats endpoint (should not be tracked)
  // Admin routes are mounted at /api/v1/admin, so stats endpoints are /api/v1/admin/stats/*
  const isAdminStatsEndpoint = endpoint.includes("/api/v1/admin/stats");

  // Check if user is admin (admins don't have API call limits)
  const isAdmin = userRole === "admin";

  // Update user API count (only for authenticated users, successful calls, non-auth endpoints, non-admin stats endpoints, and non-admin users)
  if (
    userId &&
    userId !== "anonymous" &&
    statusCode >= 200 &&
    statusCode < 300 &&
    !isAuthEndpoint &&
    !isAdminStatsEndpoint &&
    !isAdmin
  ) {
    // Use setImmediate to avoid blocking the response
    setImmediate(() => {
      incrementUserApiCount(userId).catch((err) => {
        console.error("Error incrementing API count:", err);
      });
    });
  }

  // Update endpoint statistics (only for successful calls, non-auth endpoints, and non-admin stats endpoints)
  // Exclude auth endpoints and admin stats endpoints from endpoint stats
  if (statusCode >= 200 && statusCode < 300 && !isAuthEndpoint && !isAdminStatsEndpoint) {
    const endpointKey = `${method} ${endpoint}`;
    const currentCount = endpointStats.get(endpointKey) || 0;
    endpointStats.set(endpointKey, currentCount + 1);

    // Track latest call for this endpoint
    endpointLastCall.set(endpointKey, {
      userId: userId || "anonymous",
      timestamp: timestamp,
    });

    // Track which users called this endpoint (for per-user endpoint stats)
    // Count total requests per endpoint per user
    if (userId && userId !== "anonymous") {
      if (!endpointUserStats.has(endpointKey)) {
        endpointUserStats.set(endpointKey, new Map());
      }
      const userStats = endpointUserStats.get(endpointKey);
      // Increment count for each request to this endpoint by this user
      const currentUserCount = userStats.get(userId) || 0;
      userStats.set(userId, currentUserCount + 1);
    }
  }

  // Log to console
  const userDisplay =
    userId && userId !== "anonymous" ? `User: ${userId}` : "User: anonymous";
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
    const [method, endpoint] = endpointKey.split(" ", 2);
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

    const sortedUsers = [...users];
    sortedUsers.sort((a, b) => b.count - a.count);

    stats.push({
      method,
      endpoint,
      requests: count,
      users: sortedUsers,
      lastCall: lastCall
        ? {
            userId: lastCall.userId,
            timestamp: lastCall.timestamp,
          }
        : null,
    });
  }
  const sortedStats = [...stats];
  sortedStats.sort((a, b) => b.requests - a.requests);
  return sortedStats;
};

/**
 * Get user API consumption statistics from database
 * @returns {Promise<Array>} Array of user consumption stats
 */
const getUserConsumptionStats = async () => {
  try {
    const users = await db.query(
      "SELECT user_id, api_calls FROM `user` ORDER BY api_calls DESC"
    );

    return users.map((user) => ({
      userId: user.user_id.toString(),
      totalRequests: user.api_calls || 0,
    }));
  } catch (error) {
    console.error("Error getting user consumption stats:", error);
    return [];
  }
};

/**
 * Get per-endpoint API consumption for a specific user
 * Returns total number of requests per endpoint for the user
 * @param {string} userId - User ID
 * @returns {Array} Array of endpoint stats for the user
 */
const getUserEndpointStats = (userId) => {
  const userEndpointStats = [];

  for (const [endpointKey, userStats] of endpointUserStats) {
    const userCount = userStats.get(userId);
    if (userCount && userCount > 0) {
      const [method, endpoint] = endpointKey.split(" ", 2);

      // Check if this is an auth endpoint - exclude from user's endpoint breakdown
      // Auth routes are mounted at /api/v1/auth, so full paths are /api/v1/auth/login, /api/v1/auth/signup, /api/v1/auth/profile
      // Also check route paths (/login, /signup, /profile) in case endpoint is captured differently
      // /api/v1/auth/users is an admin-only endpoint for listing users, should not be tracked
      const isAuthEndpoint =
        endpoint.includes("/api/v1/auth/login") ||
        endpoint.includes("/api/v1/auth/signup") ||
        endpoint.includes("/api/v1/auth/profile") ||
        endpoint.includes("/api/v1/auth/users") ||
        endpoint === "/login" ||
        endpoint === "/signup" ||
        endpoint === "/profile" ||
        endpoint === "/users" ||
        endpoint.includes("/auth/login") ||
        endpoint.includes("/auth/signup") ||
        endpoint.includes("/auth/profile") ||
        endpoint.includes("/auth/users");

      // Check if this is an admin stats endpoint - exclude from user's endpoint breakdown
      // Admin routes are mounted at /api/v1/admin, so stats endpoints are /api/v1/admin/stats/*
      const isAdminStatsEndpoint = endpoint.includes("/api/v1/admin/stats");

      // Only include non-auth and non-admin-stats endpoints in user's breakdown
      if (!isAuthEndpoint && !isAdminStatsEndpoint) {
        userEndpointStats.push({
          method,
          endpoint,
          requests: userCount, // Total number of requests to this endpoint by this user
        });
      }
    }
  }

  // Sort by endpoint name for consistency
  userEndpointStats.sort((a, b) => {
    const aKey = `${a.method} ${a.endpoint}`;
    const bKey = `${b.method} ${b.endpoint}`;
    return aKey.localeCompare(bKey);
  });
  return userEndpointStats;
};

/**
 * Get all API call logs (admin only)
 * @param {number} limit - Maximum number of logs to return
 * @returns {Array} Array of API call logs
 */
const getAllApiLogs = (limit = 1000) => {
  const sortedLogs = [...apiCallLogs].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  return sortedLogs.slice(0, limit);
};

/**
 * Reset API call count for a user in database (admin function)
 * @param {string} userId - User ID
 */
const resetUserApiCount = async (userId) => {
  const userIdInt = parseUserIdForTracking(userId);
  if (!userIdInt) {
    return;
  }

  try {
    // Get current count to reset to 0
    const currentCount = await getUserApiCallsFromDb(userIdInt);
    await updateUserApiCallsInDb(userIdInt, -currentCount);
    console.log(`[API Tracker] Reset API count for user ${userId}`);
  } catch (error) {
    console.error("Error resetting user API count:", error);
    throw error;
  }
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
  res.on("finish", () => {
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
    let endpoint = req.path || req.url?.split("?")[0] || "/";

    // Try to get the full path with baseUrl if available
    if (req.baseUrl && req.route?.path) {
      // Combine baseUrl (mount point) with route path for accurate endpoint
      endpoint = req.baseUrl + req.route.path;
    } else if (req.baseUrl && !req.route?.path) {
      // If we have baseUrl but no route path, use baseUrl + path
      endpoint = req.baseUrl + (req.path || "");
    }

    // Normalize endpoint (remove trailing slash except for root)
    if (endpoint !== "/" && endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }

    // Track the API call (pass userRole to exclude admin users from counting)
    trackApiCall(
      method,
      endpoint,
      finalUserId,
      statusCode,
      responseTime,
      userRole
    );

    // Check if this is an auth endpoint (should not show warning)
    // Auth routes are mounted at /api/v1/auth, so full paths are /api/v1/auth/login, /api/v1/auth/signup, /api/v1/auth/profile
    // Also check route paths (/login, /signup, /profile) in case endpoint is captured differently
    // /api/v1/auth/users is an admin-only endpoint for listing users, should not be tracked
    const isAuthEndpoint =
      endpoint.includes("/api/v1/auth/login") ||
      endpoint.includes("/api/v1/auth/signup") ||
      endpoint.includes("/api/v1/auth/profile") ||
      endpoint.includes("/api/v1/auth/users") ||
      endpoint === "/login" ||
      endpoint === "/signup" ||
      endpoint === "/profile" ||
      endpoint === "/users" ||
      endpoint.includes("/auth/login") ||
      endpoint.includes("/auth/signup") ||
      endpoint.includes("/auth/profile") ||
      endpoint.includes("/auth/users");

    // Check if this is an admin stats endpoint (should not show warning)
    // Admin routes are mounted at /api/v1/admin, so stats endpoints are /api/v1/admin/stats/*
    const isAdminStatsEndpoint = endpoint.includes("/api/v1/admin/stats");

    // Add warning header if user has exceeded limit (only for authenticated users, successful calls, non-auth endpoints, non-admin stats endpoints, and non-admin users)
    if (
      finalUserId &&
      finalUserId !== "anonymous" &&
      statusCode >= 200 &&
      statusCode < 300 &&
      !isAuthEndpoint &&
      !isAdminStatsEndpoint &&
      userRole !== "admin"
    ) {
      // Use setImmediate to avoid blocking the response
      setImmediate(async () => {
        try {
          const exceeded = await hasExceededLimit(finalUserId, userRole);
          if (exceeded) {
            res.setHeader("X-API-Limit-Exceeded", "true");
            res.setHeader(
              "X-API-Limit-Message",
              apiTrackingMessages.apiLimitExceededMessage(FREE_API_CALLS_LIMIT)
            );
          }
        } catch (error) {
          console.error("Error checking API limit:", error);
        }
      });
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
