const jukeboxService = require("../services/jukeboxService");
const votingService = require("../services/votingService");

/**
 * Start jukebox mode
 */
async function startJukebox(req, res) {
  try {
    const ownerId = req.userId;
    const { roundId } = req.body;

    if (!roundId) {
      return res.status(400).json({
        success: false,
        message: "roundId is required",
      });
    }

    // Verify round belongs to owner
    const round = votingService.getRoundById(roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Round not found",
      });
    }

    if (round.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "Only the round owner can start jukebox",
      });
    }

    // Verify round has a winner
    const results = votingService.getVotingResults(roundId, round.currentRoundNumber);
    if (!results.winner) {
      return res.status(400).json({
        success: false,
        message: "Round must have a winner before starting jukebox. Ensure voting has completed.",
      });
    }

    const jukebox = await jukeboxService.startJukebox(ownerId, roundId);

    return res.status(200).json({
      success: true,
      message: "Jukebox started successfully",
      data: jukebox,
    });
  } catch (error) {
    console.error("Error starting jukebox:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error starting jukebox",
    });
  }
}

/**
 * Get jukebox status
 */
async function getJukeboxStatus(req, res) {
  try {
    const ownerId = req.userId;
    const status = jukeboxService.getJukeboxStatus(ownerId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Jukebox not found or not started",
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting jukebox status:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error getting jukebox status",
    });
  }
}

/**
 * Stop jukebox
 */
async function stopJukebox(req, res) {
  try {
    const ownerId = req.userId;
    jukeboxService.stopJukebox(ownerId);

    return res.status(200).json({
      success: true,
      message: "Jukebox stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping jukebox:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error stopping jukebox",
    });
  }
}

/**
 * Get voting round for jukebox (public endpoint for voting page)
 */
async function getJukeboxVotingRound(req, res) {
  try {
    const { ownerId } = req.params;
    const votingRound = jukeboxService.getJukeboxVotingRound(ownerId);

    if (!votingRound) {
      return res.status(404).json({
        success: false,
        message: "No active voting round for this jukebox",
      });
    }

    // Get full round details
    const round = votingService.getRoundById(votingRound.roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Voting round not found",
      });
    }

    const songs = votingService.getSongsByRound(votingRound.roundId, votingRound.roundNumber);
    const results = votingService.getVotingResults(votingRound.roundId, votingRound.roundNumber);

    return res.status(200).json({
      success: true,
      data: {
        round: {
          id: round.id,
          status: round.status,
          currentRoundNumber: round.currentRoundNumber,
          genre: round.genre,
          bpm: round.bpm,
          artists: round.artists,
          mood: round.mood,
          energy: round.energy,
        },
        songs,
        results,
      },
    });
  } catch (error) {
    console.error("Error getting jukebox voting round:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error getting jukebox voting round",
    });
  }
}

/**
 * Get jukebox now playing (public endpoint)
 */
async function getJukeboxNowPlaying(req, res) {
  try {
    const { ownerId } = req.params;
    const status = jukeboxService.getJukeboxStatus(ownerId);

    if (!status || !status.isActive || !status.nowPlaying) {
      return res.status(404).json({
        success: false,
        message: "No song currently playing",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        nowPlaying: status.nowPlaying,
        timeRemainingMs: status.timeRemainingMs,
        timeRemainingSeconds: status.timeRemainingSeconds,
        progress: status.progress,
      },
    });
  } catch (error) {
    console.error("Error getting jukebox now playing:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error getting jukebox now playing",
    });
  }
}

/**
 * Skip current song
 */
async function skipCurrentSong(req, res) {
  try {
    const ownerId = req.userId;
    const jukebox = await jukeboxService.skipCurrentSong(ownerId);

    return res.status(200).json({
      success: true,
      message: "Song skipped successfully",
      data: jukebox,
    });
  } catch (error) {
    console.error("Error skipping song:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error skipping song",
    });
  }
}

/**
 * Pause jukebox
 */
async function pauseJukebox(req, res) {
  try {
    const ownerId = req.userId;
    jukeboxService.pauseJukebox(ownerId);

    return res.status(200).json({
      success: true,
      message: "Jukebox paused successfully",
    });
  } catch (error) {
    console.error("Error pausing jukebox:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error pausing jukebox",
    });
  }
}

/**
 * Resume jukebox
 */
async function resumeJukebox(req, res) {
  try {
    const ownerId = req.userId;
    jukeboxService.resumeJukebox(ownerId);

    return res.status(200).json({
      success: true,
      message: "Jukebox resumed successfully",
    });
  } catch (error) {
    console.error("Error resuming jukebox:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error resuming jukebox",
    });
  }
}

module.exports = {
  startJukebox,
  getJukeboxStatus,
  stopJukebox,
  getJukeboxVotingRound,
  getJukeboxNowPlaying,
  skipCurrentSong,
  pauseJukebox,
  resumeJukebox,
};

