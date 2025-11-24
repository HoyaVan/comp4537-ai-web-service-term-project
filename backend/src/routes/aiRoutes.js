const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authenticateApiKey } = require("../middleware/apiKeyMiddleware");

/**
 * @swagger
 * /api/v1/ai/health:
 *   get:
 *     summary: Check AI agent health
 *     tags: [AI Agent]
 *     responses:
 *       200:
 *         description: AI agent is healthy and connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 connected:
 *                   type: boolean
 *                   example: true
 *       503:
 *         description: AI agent is not reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 connected:
 *                   type: boolean
 *                   example: false
 */
router.get("/health", aiController.checkAIAgentHealth);

/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Send message to AI agent
 *     tags: [AI Agent]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Generate 10 pop songs with high energy"
 *               prompt:
 *                 type: string
 *                 example: "You are a music recommendation assistant"
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: AI response received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: AI agent response
 *       400:
 *         description: Bad request (validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/chat", authenticateApiKey, aiController.sendMessage);

/**
 * @swagger
 * /api/v1/ai/call:
 *   post:
 *     summary: Call AI agent endpoint
 *     tags: [AI Agent]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *                 example: "/v2/ai/agents/{agent_id}/chat"
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PUT, PATCH, DELETE]
 *                 default: POST
 *               data:
 *                 type: object
 *                 description: Request payload for the endpoint
 *     responses:
 *       200:
 *         description: AI agent endpoint called successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Response from AI agent endpoint
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/call", authenticateApiKey, aiController.callAgentEndpoint);

module.exports = router;
