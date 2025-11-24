const express = require("express");
const router = express.Router();
const spotifyController = require("../controllers/spotifyController");
const { authenticateToken } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/v1/spotify/search:
 *   get:
 *     summary: Search Spotify tracks
 *     tags: [Spotify]
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
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       artists:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.get("/search", spotifyController.searchSpotifyTracks);

/**
 * @swagger
 * /api/v1/spotify/tracks/{trackId}:
 *   get:
 *     summary: Get Spotify track information
 *     tags: [Spotify]
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema:
 *           type: string
 *         example: spotify:track:123
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
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     artists:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get("/tracks/:trackId", spotifyController.getSpotifyTrack);

/**
 * @swagger
 * /api/v1/spotify/oauth/authorize:
 *   get:
 *     summary: Initiate Spotify OAuth flow
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: scopes
 *         schema:
 *           type: string
 *         description: Comma-separated list of scopes
 *     responses:
 *       302:
 *         description: Redirects to Spotify authorization page
 */
// OAuth initiation - requires authentication to associate tokens with user
router.get("/auth", authenticateToken, spotifyController.initiateOAuth);

/**
 * @swagger
 * /api/v1/spotify/oauth/callback:
 *   get:
 *     summary: Handle Spotify OAuth callback
 *     tags: [Spotify]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OAuth callback handled successfully
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
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: integer
 *                     token_type:
 *                       type: string
 *                     scope:
 *                       type: string
 */
router.get("/callback", spotifyController.handleOAuthCallback);

/**
 * @swagger
 * /api/v1/spotify/me/token:
 *   get:
 *     summary: Get current user's Spotify token information
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token information retrieved successfully
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
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: integer
 *                     token_type:
 *                       type: string
 *                     scope:
 *                       type: string
 */
router.get("/me/token", authenticateToken, spotifyController.getSpotifyToken);

/**
 * @swagger
 * /api/v1/spotify/me/queue:
 *   post:
 *     summary: Add a track to the user's Spotify playback queue
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trackUri
 *             properties:
 *               trackUri:
 *                 type: string
 *                 description: Spotify track URI (e.g., "spotify:track:4iV5W9uYEdYUVa79Axb7Rh")
 *                 example: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh"
 *               trackId:
 *                 type: string
 *                 description: Spotify track ID (alternative to trackUri)
 *                 example: "4iV5W9uYEdYUVa79Axb7Rh"
 *               deviceId:
 *                 type: string
 *                 description: Optional device ID (uses active device if not provided)
 *     responses:
 *       200:
 *         description: Track added to queue successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request (missing trackUri/trackId, not connected to Spotify, etc.)
 *       401:
 *         description: Authentication required or Spotify authentication failed
 *       403:
 *         description: Spotify Premium required
 *       404:
 *         description: No active Spotify device found
 */
router.post("/me/queue", authenticateToken, spotifyController.addTrackToQueue);

module.exports = router;
