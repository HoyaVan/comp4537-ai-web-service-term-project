const authService = require("../services/authService");

/**
 * Middleware to verify JWT token
 */
function authenticateToken(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  // Verify token
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // Get user from decoded token
  const user = authService.getUserById(decoded.userId);
  if (!user) {
    return res.status(403).json({
      success: false,
      message: "User not found",
    });
  }

  // Attach user to request
  req.user = user;
  req.userId = decoded.userId;
  next();
}

module.exports = {
  authenticateToken,
};
