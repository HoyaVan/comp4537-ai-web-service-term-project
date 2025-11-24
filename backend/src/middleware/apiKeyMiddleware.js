const commonMessages = require("../messages/common");

/**
 * Middleware to verify API key authentication
 * Uses AI_AGENT_API_KEY for backend authentication (same key as Digital Ocean agent)
 */

function authenticateApiKey(req, res, next) {
  // Use AI_AGENT_API_KEY as the backend API key (same key for simplicity)
  const apiKey = process.env.API_KEY || process.env.AI_AGENT_API_KEY;
  
  // If no API key is configured, allow access (for development)
  if (!apiKey) {
    console.warn("⚠️  No API_KEY or AI_AGENT_API_KEY configured - allowing unauthenticated access");
    return next();
  }

  // Get API key from Authorization header or x-api-key header
  const authHeader = req.headers["authorization"];
  const headerApiKey = authHeader && authHeader.startsWith("Bearer ") 
    ? authHeader.split(" ")[1] 
    : req.headers["x-api-key"];

  if (!headerApiKey) {
    return res.status(401).json({
      success: false,
      message: commonMessages.apiKeyRequired,
      hint: "Use your AI_AGENT_API_KEY for authentication",
    });
  }

  if (headerApiKey !== apiKey) {
    return res.status(403).json({
      success: false,
      message: commonMessages.invalidApiKey,
    });
  }

  // API key is valid
  next();
}

module.exports = {
  authenticateApiKey,
};

