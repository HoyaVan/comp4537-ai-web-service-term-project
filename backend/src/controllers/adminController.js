const {
  getEndpointStats,
  getUserConsumptionStats,
  getAllApiLogs,
  resetUserApiCount,
} = require("../middleware/apiTrackingMiddleware");
const authService = require("../services/authService");
const adminMessages = require("../messages/admin");

/**
 * Get API endpoint statistics (admin only)
 * Shows how many times each endpoint was called
 */
async function getApiEndpointStats(req, res) {
  try {
    // Check if user is admin
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: adminMessages.adminAccessRequired,
      });
    }

    const stats = getEndpointStats();
    
      // Enrich endpoint stats with user details
      const enrichedStats = await Promise.all(stats.map(async (stat) => {
        // Only enrich users if the users array exists and has items
        let enrichedUsers = [];
        if (stat.users && Array.isArray(stat.users) && stat.users.length > 0) {
          enrichedUsers = await Promise.all(stat.users.map(async (user) => {
            const userDetails = await authService.getUserById(user.userId);
            return {
              userId: user.userId,
              name: userDetails?.name || 'Unknown',
              email: userDetails?.email || 'Unknown',
              count: user.count,
            };
          }));
        }
        
        // Enrich last call info
        let lastCallInfo = null;
        if (stat.lastCall && stat.lastCall.userId && stat.lastCall.userId !== 'anonymous') {
          const lastCallUser = await authService.getUserById(stat.lastCall.userId);
          lastCallInfo = {
            userId: stat.lastCall.userId,
            email: lastCallUser?.email || 'Unknown',
            timestamp: stat.lastCall.timestamp,
          };
        }
        
        return {
          method: stat.method,
          endpoint: stat.endpoint,
          requests: stat.requests,
          users: enrichedUsers,
          lastCall: lastCallInfo,
        };
      }));

    return res.status(200).json({
      success: true,
      data: enrichedStats,
      count: enrichedStats.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: adminMessages.errorFetchingEndpointStats,
      error: error.message,
    });
  }
}

/**
 * Get user API consumption statistics (admin only)
 * Shows API usage breakdown for each user
 */
async function getUserApiConsumptionStats(req, res) {
  try {
    // Check if user is admin
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: adminMessages.adminAccessRequired,
      });
    }

    const consumptionStats = await getUserConsumptionStats();
    
    // Enrich with user details
    const enrichedStats = await Promise.all(consumptionStats.map(async (stat) => {
      const userDetails = await authService.getUserById(stat.userId);
      return {
        userId: stat.userId,
        name: userDetails?.name || 'Unknown',
        email: userDetails?.email || 'Unknown',
        totalRequests: stat.totalRequests,
      };
    }));

    return res.status(200).json({
      success: true,
      data: enrichedStats,
      count: enrichedStats.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: adminMessages.errorFetchingUserConsumptionStats,
      error: error.message,
    });
  }
}

/**
 * Get all API call logs (admin only)
 * Returns detailed logs of all API calls
 */
async function getAllApiCallLogs(req, res) {
  try {
    // Check if user is admin
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: adminMessages.adminAccessRequired,
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const logs = getAllApiLogs(limit);

    return res.status(200).json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: adminMessages.errorFetchingApiLogs,
      error: error.message,
    });
  }
}

/**
 * Reset API call count for a user (admin only)
 */
async function resetUserApiCallCount(req, res) {
  try {
    // Check if user is admin
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: adminMessages.adminAccessRequired,
      });
    }

    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: adminMessages.userIdRequired,
      });
    }

    // Check if user exists
    const targetUser = await authService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: adminMessages.userNotFound,
      });
    }

    await resetUserApiCount(userId);

    return res.status(200).json({
      success: true,
      message: adminMessages.apiCallCountReset(userId),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: adminMessages.errorResettingApiCallCount,
      error: error.message,
    });
  }
}

module.exports = {
  getApiEndpointStats,
  getUserApiConsumptionStats,
  getAllApiCallLogs,
  resetUserApiCallCount,
};

