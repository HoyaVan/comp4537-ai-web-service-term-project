const express = require("express");
const router = express.Router();
const jukeboxController = require("../controllers/jukeboxController");
const { authenticateToken } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/v1/jukebox/start:
 *   post:
 *     summary: Start jukebox mode
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roundId
 *             properties:
 *               roundId:
 *                 type: string
 *                 example: round123
 *     responses:
 *       200:
 *         description: Jukebox started successfully
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
 *                     ownerId:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     votingRound:
 *                       type: object
 *                       properties:
 *                         roundId:
 *                           type: string
 *                         roundNumber:
 *                           type: integer
 *                     nowPlaying:
 *                       type: object
 */
router.post("/start", authenticateToken, jukeboxController.startJukebox);

/**
 * @swagger
 * /api/v1/jukebox/status:
 *   get:
 *     summary: Get jukebox status
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jukebox status retrieved successfully
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
 *                     ownerId:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     votingRound:
 *                       type: object
 *                     nowPlaying:
 *                       type: object
 *                     timeRemainingMs:
 *                       type: integer
 *                     timeRemainingSeconds:
 *                       type: integer
 *                     progress:
 *                       type: number
 *       404:
 *         description: Jukebox not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/status", authenticateToken, jukeboxController.getJukeboxStatus);

/**
 * @swagger
 * /api/v1/jukebox/stop:
 *   post:
 *     summary: Stop jukebox
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jukebox stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/stop", authenticateToken, jukeboxController.stopJukebox);

/**
 * @swagger
 * /api/v1/jukebox/skip:
 *   post:
 *     summary: Skip current song
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Song skipped successfully
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
 *                     nowPlaying:
 *                       type: object
 */
router.post("/skip", authenticateToken, jukeboxController.skipCurrentSong);

/**
 * @swagger
 * /api/v1/jukebox/pause:
 *   post:
 *     summary: Pause jukebox
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jukebox paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/pause", authenticateToken, jukeboxController.pauseJukebox);

/**
 * @swagger
 * /api/v1/jukebox/resume:
 *   post:
 *     summary: Resume jukebox
 *     tags: [Jukebox]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jukebox resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/resume", authenticateToken, jukeboxController.resumeJukebox);

/**
 * @swagger
 * /api/v1/jukebox/owners/{ownerId}/voting-round:
 *   get:
 *     summary: Get voting round for jukebox (public endpoint)
 *     tags: [Jukebox]
 *     parameters:
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Voting round retrieved successfully
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
 *       404:
 *         description: No active voting round found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/owners/:ownerId/voting-round", jukeboxController.getJukeboxVotingRound);

/**
 * @swagger
 * /api/v1/jukebox/owners/{ownerId}/now-playing:
 *   get:
 *     summary: Get currently playing song (public endpoint)
 *     tags: [Jukebox]
 *     parameters:
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Now playing information retrieved successfully
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
 *                     nowPlaying:
 *                       type: object
 *                       properties:
 *                         song:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             artist:
 *                               type: string
 *                             spotifyId:
 *                               type: string
 *                     timeRemainingMs:
 *                       type: integer
 *                     timeRemainingSeconds:
 *                       type: integer
 *                     progress:
 *                       type: number
 *       404:
 *         description: No song currently playing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/owners/:ownerId/now-playing", jukeboxController.getJukeboxNowPlaying);

module.exports = router;
