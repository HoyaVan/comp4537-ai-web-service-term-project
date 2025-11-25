const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");

// All admin routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/admin/stats/endpoints:
 *   get:
 *     summary: Get API endpoint statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Returns statistics for each API endpoint including request counts and user breakdown. Requires admin role.
 *     responses:
 *       200:
 *         description: Endpoint statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       method:
 *                         type: string
 *                       endpoint:
 *                         type: string
 *                       requests:
 *                         type: integer
 *                       users:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             count:
 *                               type: integer
 *                 count:
 *                   type: integer
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/stats/endpoints", adminController.getApiEndpointStats);

/**
 * @swagger
 * /api/v1/admin/stats/users:
 *   get:
 *     summary: Get user API consumption statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Returns API usage breakdown for each user. Requires admin role.
 *     responses:
 *       200:
 *         description: User consumption statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       totalRequests:
 *                         type: integer
 *                 count:
 *                   type: integer
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/stats/users", adminController.getUserApiConsumptionStats);

/**
 * @swagger
 * /api/v1/admin/stats/logs:
 *   get:
 *     summary: Get all API call logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Returns detailed logs of all API calls. Requires admin role.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of logs to return
 *     responses:
 *       200:
 *         description: API call logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       method:
 *                         type: string
 *                       endpoint:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       statusCode:
 *                         type: integer
 *                       responseTime:
 *                         type: integer
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: integer
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/stats/logs", adminController.getAllApiCallLogs);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/reset-api-count:
 *   post:
 *     summary: Reset API call count for a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Resets the API call count for a specific user. Requires admin role.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API call count reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: API call count reset for user user123
 *       400:
 *         description: Bad request - userId required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/v1/admin/users/{userId}/api-consumption:
 *   get:
 *     summary: Get individual user API consumption
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Returns detailed API consumption for a specific user including endpoint breakdown. Requires admin role.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User API consumption retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                     apiConsumption:
 *                       type: object
 *                       properties:
 *                         callsUsed:
 *                           type: integer
 *                         callsLimit:
 *                           type: integer
 *                         remainingCalls:
 *                           type: integer
 *                         hasExceededLimit:
 *                           type: boolean
 *                         endpointBreakdown:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               method:
 *                                 type: string
 *                               endpoint:
 *                                 type: string
 *                               requests:
 *                                 type: integer
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/users/:userId/api-consumption", adminController.getUserApiConsumption);

router.post("/users/:userId/reset-api-count", adminController.resetUserApiCallCount);

module.exports = router;
