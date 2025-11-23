const express = require("express");
const router = express.Router();
const jukeboxController = require("../controllers/jukeboxController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Owner-only routes (require authentication)
router.post("/start", authenticateToken, jukeboxController.startJukebox);
router.get("/status", authenticateToken, jukeboxController.getJukeboxStatus);
router.post("/stop", authenticateToken, jukeboxController.stopJukebox);
router.post("/skip", authenticateToken, jukeboxController.skipCurrentSong);
router.post("/pause", authenticateToken, jukeboxController.pauseJukebox);
router.post("/resume", authenticateToken, jukeboxController.resumeJukebox);

// Public routes (for voting page and display)
router.get("/:ownerId/voting-round", jukeboxController.getJukeboxVotingRound);
router.get("/:ownerId/now-playing", jukeboxController.getJukeboxNowPlaying);

module.exports = router;

