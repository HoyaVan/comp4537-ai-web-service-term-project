const express = require("express");
const router = express.Router();
const spotifyController = require("../controllers/spotifyController");

router.get("/search", spotifyController.searchSpotifyTracks);
router.get("/tracks/:trackId", spotifyController.getSpotifyTrack);
router.get("/auth", spotifyController.initiateOAuth);
router.get("/callback", spotifyController.handleOAuthCallback);

module.exports = router;
