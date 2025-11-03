const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authenticateApiKey } = require("../middleware/apiKeyMiddleware");

// Health check endpoint for AI agent (public)
router.get("/health", aiController.checkAIAgentHealth);

// Option 1: Use API key authentication (simpler - just needs API key)
// Uncomment these lines to use API key auth instead of JWT
router.post("/chat", authenticateApiKey, aiController.sendMessage);
router.post("/call", authenticateApiKey, aiController.callAgentEndpoint);

// Option 2: Use JWT authentication (requires user login)
// Uncomment these lines to use JWT auth instead of API key
// router.post("/chat", authenticateToken, aiController.sendMessage);
// router.post("/call", authenticateToken, aiController.callAgentEndpoint);

module.exports = router;

