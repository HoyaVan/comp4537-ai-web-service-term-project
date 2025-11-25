const express = require("express");
const router = express.Router();
const votingController = require("../controllers/votingController");
const { authenticateToken } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/v1/voting/rounds:
 *   post:
 *     summary: Create a new voting round
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               genre:
 *                 type: string
 *                 example: Pop
 *               bpm:
 *                 type: integer
 *                 example: 120
 *               artists:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Artist 1", "Artist 2"]
 *               mood:
 *                 type: string
 *                 example: energetic
 *               energy:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: high
 *     responses:
 *       201:
 *         description: Voting round created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     round:
 *                       $ref: '#/components/schemas/Round'
 *                     songs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Song'
 */
router.post("/rounds", authenticateToken, votingController.createRound);

/**
 * @swagger
 * /api/v1/voting/rounds:
 *   get:
 *     summary: Get all rounds for the authenticated owner
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rounds retrieved successfully
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
 *                     $ref: '#/components/schemas/Round'
 */
router.get("/rounds", authenticateToken, votingController.getMyRounds);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}:
 *   get:
 *     summary: Get round details (public endpoint)
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Round details retrieved successfully
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
 *                     round:
 *                       $ref: '#/components/schemas/Round'
 *                     songs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Song'
 *                     results:
 *                       $ref: '#/components/schemas/VotingResults'
 */
router.get("/rounds/:roundId", votingController.getRound);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/vote:
 *   post:
 *     summary: Submit a vote for a song
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - songId
 *             properties:
 *               songId:
 *                 type: string
 *                 example: song1
 *               participantToken:
 *                 type: string
 *                 example: optional_token
 *     responses:
 *       200:
 *         description: Vote submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     participantToken:
 *                       type: string
 *                     results:
 *                       $ref: '#/components/schemas/VotingResults'
 */
router.post("/rounds/:roundId/vote", votingController.submitVote);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/results:
 *   get:
 *     summary: Get detailed voting results (owner only)
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roundNumber
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Voting results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VotingResults'
 */
router.get("/rounds/:roundId/results", authenticateToken, votingController.getResults);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/public-results:
 *   get:
 *     summary: Get public voting results
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public voting results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VotingResults'
 */
router.get("/rounds/:roundId/public-results", votingController.getResults);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/next-round:
 *   post:
 *     summary: Generate next round with AI based on previous voting patterns
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Next round generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     round:
 *                       $ref: '#/components/schemas/Round'
 *                     songs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Song'
 */
router.post("/rounds/:roundId/next-round", authenticateToken, votingController.generateNextRound);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/status:
 *   patch:
 *     summary: Update round status
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed]
 *                 example: paused
 *     responses:
 *       200:
 *         description: Round status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.patch("/rounds/:roundId/status", authenticateToken, votingController.updateRoundStatus);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/end:
 *   post:
 *     summary: End a voting round (set status to completed)
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Round ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Round'
 *       403:
 *         description: Only the round owner can end the round
 *       404:
 *         description: Round not found
 */
router.post("/rounds/:roundId/end", authenticateToken, votingController.endRound);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/qr:
 *   get:
 *     summary: Get QR code data for voting page
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code data retrieved successfully
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
 *                     url:
 *                       type: string
 *                       example: http://localhost:8080/vote.html?round=round123
 *                     qrCodeData:
 *                       type: string
 *                       example: data:image/png;base64,...
 */
router.get("/rounds/:roundId/qr", authenticateToken, votingController.getQRCode);

/**
 * @swagger
 * /api/v1/voting/rounds/{roundId}/countdown:
 *   get:
 *     summary: Get round countdown information
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Countdown information retrieved successfully
 */
router.get("/rounds/:roundId/countdown", votingController.getRoundCountdown);

/**
 * @swagger
 * /api/v1/voting/spotify/search:
 *   get:
 *     summary: Search Spotify tracks
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         example: pop songs
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Spotify tracks retrieved successfully
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
 */
router.get("/spotify/search", authenticateToken, votingController.searchSpotifyTracks);

/**
 * @swagger
 * /api/v1/voting/spotify/tracks/{trackId}:
 *   get:
 *     summary: Get Spotify track information
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Track information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get("/spotify/tracks/:trackId", votingController.getSpotifyTrack);

module.exports = router;
