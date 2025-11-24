const express = require("express");
const router = express.Router();
const spotifyController = require("../controllers/spotifyController");

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
 * /api/v1/spotify/auth:
 *   get:
 *     summary: Initiate Spotify OAuth flow
 *     tags: [Spotify]
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
router.get("/auth", spotifyController.initiateOAuth);

/**
 * @swagger
 * /api/v1/spotify/callback:
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
 * /api/v1/spotify/token:
 *   get:
 *     summary: Get current Spotify token information
 *     tags: [Spotify]
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
router.get("/token", spotifyController.setSpotifyToken);

module.exports = router;
