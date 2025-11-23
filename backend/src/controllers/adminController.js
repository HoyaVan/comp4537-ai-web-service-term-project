const {
  getEndpointStats,
  getUserConsumptionStats,
  getAllApiLogs,
  resetUserApiCount,
} = require("../middleware/apiTrackingMiddleware");
const authService = require("../services/authService");

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
        message: "Admin access required",
      });
    }

    const stats = getEndpointStats();
    
    // Enrich endpoint stats with user details
    const enrichedStats = stats.map((stat) => {
      const enrichedUsers = stat.users.map((user) => {
        const userDetails = authService.getUserById(user.userId);
        return {
          userId: user.userId,
          name: userDetails?.name || 'Unknown',
          email: userDetails?.email || 'Unknown',
          count: user.count,
        };
      });
      
      return {
        method: stat.method,
        endpoint: stat.endpoint,
        requests: stat.requests,
        users: enrichedUsers,
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedStats,
      count: enrichedStats.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching endpoint statistics",
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
        message: "Admin access required",
      });
    }

    const consumptionStats = getUserConsumptionStats();
    
    // Enrich with user details
    const enrichedStats = consumptionStats.map((stat) => {
      const userDetails = authService.getUserById(stat.userId);
      return {
        userId: stat.userId,
        name: userDetails?.name || 'Unknown',
        email: userDetails?.email || 'Unknown',
        totalRequests: stat.totalRequests,
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedStats,
      count: enrichedStats.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching user consumption statistics",
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
        message: "Admin access required",
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
      message: "Error fetching API call logs",
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
        message: "Admin access required",
      });
    }

    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check if user exists
    const targetUser = authService.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    resetUserApiCount(userId);

    return res.status(200).json({
      success: true,
      message: `API call count reset for user ${userId}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error resetting user API call count",
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

