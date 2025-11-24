const authService = require("../services/authService");
const { getUserApiCount, getUserEndpointStats } = require("../middleware/apiTrackingMiddleware");

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
      message: "User created successfully",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Error creating user",
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
        message: "Email and password are required",
      });
    }

    // Login user
    const result = await authService.login(email, password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid credentials",
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
    
    responseData.apiConsumption = {
      callsUsed: apiCallsUsed,
      callsLimit: 'unlimited',
      hasUnlimitedCalls: true,
      endpointBreakdown: endpointStats, // Per-endpoint breakdown
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching profile",
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
      message: "Error fetching users",
    });
  }
}

module.exports = {
  signup,
  login,
  getProfile,
  getAllUsers,
};
