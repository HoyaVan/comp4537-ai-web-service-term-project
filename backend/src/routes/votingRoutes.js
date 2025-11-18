const express = require("express");
const router = express.Router();
const votingController = require("../controllers/votingController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Owner-only routes (require authentication)
router.post("/rounds", authenticateToken, votingController.createRound);
router.get("/rounds", authenticateToken, votingController.getMyRounds);
router.get("/rounds/:roundId/results", authenticateToken, votingController.getResults);
router.post("/rounds/:roundId/next-round", authenticateToken, votingController.generateNextRound);
router.patch("/rounds/:roundId/status", authenticateToken, votingController.updateRoundStatus);
router.get("/rounds/:roundId/qr", authenticateToken, votingController.getQRCode);

// Public routes (no authentication required)
router.get("/rounds/:roundId", votingController.getRound);
router.post("/rounds/:roundId/vote", votingController.submitVote);
router.get("/rounds/:roundId/public-results", votingController.getResults);

// Spotify routes (owner only for search, public for track info)
router.get("/spotify/search", authenticateToken, votingController.searchSpotifyTracks);
router.get("/spotify/tracks/:trackId", votingController.getSpotifyTrack);

module.exports = router;
