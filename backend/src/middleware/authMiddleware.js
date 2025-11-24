const authService = require("../services/authService");
const commonMessages = require("../messages/common");

/**
 * Middleware to verify JWT token
 * Checks both httpOnly cookie and Authorization header for backward compatibility
 */
async function authenticateToken(req, res, next) {
  // Try to get token from httpOnly cookie first
  let token = req.cookies?.token;
  
  // Fallback to Authorization header for backward compatibility
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: commonMessages.accessTokenRequired,
    });
  }

  // Verify token
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: commonMessages.invalidOrExpiredToken,
    });
  }

  // Get user from decoded token
  const user = await authService.getUserById(decoded.userId);
  if (!user) {
    return res.status(403).json({
      success: false,
      message: commonMessages.userNotFound,
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
