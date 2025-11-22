const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");

// All admin routes require authentication
router.use(authenticateToken);

// API Statistics endpoints
router.get("/stats/endpoints", adminController.getApiEndpointStats);
router.get("/stats/users", adminController.getUserApiConsumptionStats);
router.get("/stats/logs", adminController.getAllApiCallLogs);

// User management endpoints
router.post("/users/:userId/reset-api-count", adminController.resetUserApiCallCount);

module.exports = router;

