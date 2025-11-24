const authService = require("../services/authService");
const commonMessages = require("../messages/common");

/**
 * Middleware to verify JWT token
 * Checks Authorization header first, then cookie for backward compatibility
 */
async function authenticateToken(req, res, next) {
  // Try to get token from Authorization header first
  let token = null;
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
      console.log('[authMiddleware] Token found in Authorization header');
    } else {
      console.log('[authMiddleware] Invalid Authorization header format:', authHeader.substring(0, 20) + '...');
    }
  }
  
  // Fallback to cookie for backward compatibility
  if (!token) {
    token = req.cookies?.token;
    if (token) {
      console.log('[authMiddleware] Token found in cookie');
    }
  }

  if (!token) {
    console.log('[authMiddleware] No token found in request');
    return res.status(401).json({
      success: false,
      message: commonMessages.accessTokenRequired,
    });
  }

  // Verify token
  console.log('[authMiddleware] Verifying token...');
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    console.log('[authMiddleware] Token verification failed - invalid or expired');
    return res.status(403).json({
      success: false,
      message: commonMessages.invalidOrExpiredToken,
    });
  }

  console.log('[authMiddleware] Token verified, userId:', decoded.userId);

  // Get user from decoded token
  const user = await authService.getUserById(decoded.userId);
  if (!user) {
    console.log('[authMiddleware] User not found for userId:', decoded.userId);
    return res.status(403).json({
      success: false,
      message: commonMessages.userNotFound,
    });
  }

  console.log('[authMiddleware] User authenticated:', user.email);

  // Attach user to request
  req.user = user;
  req.userId = decoded.userId;
  next();
}

module.exports = {
  authenticateToken,
};
