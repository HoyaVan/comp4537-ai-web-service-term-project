const authService = require("../services/authService");
const { getUserApiCount, getUserEndpointStats, hasExceededLimit, getRemainingCalls, FREE_API_CALLS_LIMIT } = require("../middleware/apiTrackingMiddleware");
const authMessages = require("../messages/auth");

/**
 * Sign up controller
 */
async function signup(req, res) {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Sign up user
    const result = await authService.signup(email, password, name);

    return res.status(201).json({
      success: true,
      message: authMessages.userCreatedSuccessfully,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || authMessages.errorCreatingUser,
    });
  }
}

/**
 * Login controller
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: authMessages.emailPasswordRequired,
      });
    }

    // Login user
    const result = await authService.login(email, password);

    return res.status(200).json({
      success: true,
      message: authMessages.loginSuccessful,
      data: result,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || authMessages.invalidCredentials,
    });
  }
}

/**
 * Get current user profile
 * API consumption stats are included for all authenticated users
 */
async function getProfile(req, res) {
  try {
    // User is attached to req by authMiddleware
    const user = req.user;
    
    const responseData = { ...user };
    
    // Include API consumption for all users
    const apiCallsUsed = getUserApiCount(user.id);
    const endpointStats = getUserEndpointStats(user.id);
    const remainingCalls = getRemainingCalls(user.id);
    const exceeded = hasExceededLimit(user.id);
    
    responseData.apiConsumption = {
      callsUsed: apiCallsUsed,
      callsLimit: FREE_API_CALLS_LIMIT,
      remainingCalls: remainingCalls,
      hasExceededLimit: exceeded,
      endpointBreakdown: endpointStats, // Per-endpoint breakdown
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: authMessages.errorFetchingProfile,
    });
  }
}

/**
 * Get all users (admin function)
 */
async function getAllUsers(req, res) {
  try {
    const users = authService.getAllUsers();

    return res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: authMessages.errorFetchingUsers,
    });
  }
}

module.exports = {
  signup,
  login,
  getProfile,
  getAllUsers,
};
