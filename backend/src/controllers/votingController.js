const votingService = require("../services/votingService");
const spotifyService = require("../services/spotifyService");

/**
 * Create a new voting round (owner only)
 */
async function createRound(req, res) {
  try {
    const ownerId = req.userId;
    const roundData = req.body;

    const round = await votingService.createRound(ownerId, roundData);
    const songs = votingService.getSongsByRound(round.id, round.currentRoundNumber);

    return res.status(201).json({
      success: true,
      message: "Voting round created successfully",
      data: {
        round,
        songs,
      },
    });
  } catch (error) {
    console.error("Error creating voting round:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error creating voting round",
    });
  }
}

/**
 * Get all rounds for the owner
 */
async function getMyRounds(req, res) {
  try {
    const ownerId = req.userId;
    const rounds = votingService.getRoundsByOwner(ownerId);

    // Add song count and vote count for each round
    const roundsWithStats = rounds.map((round) => {
      const songs = votingService.getSongsByRound(round.id, round.currentRoundNumber);
      const results = votingService.getVotingResults(round.id, round.currentRoundNumber);
      return {
        ...round,
        songCount: songs.length,
        totalVotes: results.totalVotes,
        winner: results.winner,
      };
    });

    return res.status(200).json({
      success: true,
      data: roundsWithStats,
    });
  } catch (error) {
    console.error("Error getting rounds:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching rounds",
    });
  }
}

/**
 * Get round details (public - for voting page)
 */
async function getRound(req, res) {
  try {
    const { roundId } = req.params;
    const round = votingService.getRoundById(roundId);

    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Round not found",
      });
    }

    const songs = votingService.getSongsByRound(roundId, round.currentRoundNumber);
    const results = votingService.getVotingResults(roundId, round.currentRoundNumber);

    // Don't expose ownerId to public
    const { ownerId, ...publicRound } = round;

    return res.status(200).json({
      success: true,
      data: {
        round: publicRound,
        songs,
        results,
      },
    });
  } catch (error) {
    console.error("Error getting round:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching round",
    });
  }
}

/**
 * Submit a vote (public)
 */
async function submitVote(req, res) {
  try {
    const { roundId } = req.params;
    const { songId } = req.body;
    const participantToken = req.body.participantToken || req.cookies?.participantToken || null;

    if (!songId) {
      return res.status(400).json({
        success: false,
        message: "songId is required",
      });
    }

    const result = await votingService.submitVote(roundId, songId, participantToken);

    // Set cookie for participant token
    res.cookie("participantToken", result.participantToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: "lax",
    });

    // Get updated results
    const round = votingService.getRoundById(roundId);
    const results = votingService.getVotingResults(roundId, round.currentRoundNumber);

    return res.status(200).json({
      success: true,
      message: result.updated ? "Vote updated" : "Vote submitted",
      data: {
        participantToken: result.participantToken,
        results,
      },
    });
  } catch (error) {
    console.error("Error submitting vote:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error submitting vote",
    });
  }
}

/**
 * Get voting results (owner only or public)
 */
async function getResults(req, res) {
  try {
    const { roundId } = req.params;
    const { roundNumber } = req.query;

    const round = votingService.getRoundById(roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Round not found",
      });
    }

    // Check if user is owner or allow public access
    const isOwner = req.userId === round.ownerId;
    const results = votingService.getVotingResults(roundId, roundNumber ? parseInt(roundNumber) : null);

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error getting results:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching results",
    });
  }
}

/**
 * Generate next round with AI (owner only)
 */
async function generateNextRound(req, res) {
  try {
    const { roundId } = req.params;
    const ownerId = req.userId;

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
        message: "Only the round owner can generate the next round",
      });
    }

    const { round: updatedRound, songs: newSongs } = await votingService.generateNextRound(roundId);

    return res.status(200).json({
      success: true,
      message: "Next round generated successfully",
      data: {
        round: updatedRound,
        songs: newSongs,
      },
    });
  } catch (error) {
    console.error("Error generating next round:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error generating next round",
    });
  }
}

/**
 * Update round status (owner only)
 */
async function updateRoundStatus(req, res) {
  try {
    const { roundId } = req.params;
    const { status } = req.body;
    const ownerId = req.userId;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

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
        message: "Only the round owner can update the status",
      });
    }

    const updatedRound = votingService.updateRoundStatus(roundId, status);

    return res.status(200).json({
      success: true,
      message: `Round status updated to ${status}`,
      data: updatedRound,
    });
  } catch (error) {
    console.error("Error updating round status:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error updating round status",
    });
  }
}

/**
 * Get Spotify track info
 */
async function getSpotifyTrack(req, res) {
  try {
    const { trackId } = req.params;

    const track = await spotifyService.getTrack(trackId);

    return res.status(200).json({
      success: true,
      data: track,
    });
  } catch (error) {
    console.error("Error getting Spotify track:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error fetching Spotify track",
    });
  }
}

/**
 * Search Spotify tracks
 */
async function searchSpotifyTracks(req, res) {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query (q) is required",
      });
    }

    const tracks = await spotifyService.searchTracks(q, parseInt(limit));

    return res.status(200).json({
      success: true,
      data: tracks,
    });
  } catch (error) {
    console.error("Error searching Spotify tracks:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error searching Spotify tracks",
    });
  }
}

/**
 * Get QR code data for a round (owner only)
 */
async function getQRCode(req, res) {
  try {
    const { roundId } = req.params;
    const ownerId = req.userId;

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
        message: "Only the round owner can access QR code",
      });
    }

    // Generate voting page URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const votingUrl = `${frontendUrl}/vote.html?round=${roundId}`;

    // QR code data URL can be generated on frontend using a library like qrcode.js
    // Here we just return the URL to encode
    return res.status(200).json({
      success: true,
      data: {
        roundId: round.id,
        votingUrl,
        qrData: votingUrl, // Frontend can use this to generate QR code
      },
    });
  } catch (error) {
    console.error("Error getting QR code:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error generating QR code",
    });
  }
}

module.exports = {
  createRound,
  getMyRounds,
  getRound,
  submitVote,
  getResults,
  generateNextRound,
  updateRoundStatus,
  getSpotifyTrack,
  searchSpotifyTracks,
  getQRCode,
};
