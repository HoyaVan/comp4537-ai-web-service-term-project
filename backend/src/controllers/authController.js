const authService = require("../services/authService");

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
 */
async function getProfile(req, res) {
  try {
    // User is attached to req by authMiddleware
    const user = req.user;

    return res.status(200).json({
      success: true,
      data: user,
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
