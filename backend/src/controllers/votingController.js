const votingService = require("../services/votingService");
const spotifyService = require("../services/spotifyService");
const jukeboxService = require("../services/jukeboxService");

/**
 * Create a new voting round (owner only)
 */
async function createRound(req, res) {
  try {
    const ownerId = req.userId;
    const roundData = req.body;

    const round = await votingService.createRound(ownerId, roundData);
    const songs = votingService.getSongsByRound(round.id, round.currentRoundNumber);

    console.log(`[createRound Controller] Round created: ${round.id}`);
    
    // Check if jukebox was auto-started and get now playing info
    let jukeboxInfo = null;
    if (round._jukeboxInfo) {
      jukeboxInfo = round._jukeboxInfo;
      console.log(`[createRound Controller] Jukebox info from round:`, jukeboxInfo);
      // Remove internal property before sending
      delete round._jukeboxInfo;
    } else {
      // Fallback: check jukebox status directly
      const jukeboxService = require("../services/jukeboxService");
      const jukebox = jukeboxService.getJukeboxStatus(ownerId);
      console.log(`[createRound Controller] Checking jukebox status directly:`, {
        exists: !!jukebox,
        isActive: jukebox?.isActive,
        votingRoundId: jukebox?.votingRound?.roundId,
        currentRoundId: round.id,
        match: jukebox?.votingRound?.roundId === round.id,
      });
      
      // If jukebox exists but round ID doesn't match, that's the problem!
      if (jukebox && jukebox.isActive && jukebox.votingRound) {
        if (jukebox.votingRound.roundId !== round.id) {
          console.error(`[createRound Controller] ERROR: Round ID mismatch!`);
          console.error(`[createRound Controller] Returned round ID: ${round.id}`);
          console.error(`[createRound Controller] Jukebox voting round ID: ${jukebox.votingRound.roundId}`);
          console.error(`[createRound Controller] This means the wrong round was returned!`);
        }
        jukeboxInfo = {
          isActive: true,
          nowPlaying: jukebox.nowPlaying?.song,
          votingRoundId: jukebox.votingRound.roundId,
        };
      } else if (!jukebox) {
        console.warn(`[createRound Controller] No jukebox found for owner ${ownerId}`);
        console.warn(`[createRound Controller] This means the jukebox didn't start or failed to start`);
      }
    }
    
    // Log important info for debugging
    console.log(`[createRound Controller] Final response:`, {
      roundId: round.id,
      hasJukeboxInfo: !!jukeboxInfo,
      votingRoundId: jukeboxInfo?.votingRoundId,
      roundIdMatches: jukeboxInfo?.votingRoundId === round.id,
    });

    // Build success message with song name if available
    let message = "Voting round created successfully";
    if (jukeboxInfo && jukeboxInfo.nowPlaying) {
      message = `🎵 Jukebox started! Now playing: "${jukeboxInfo.nowPlaying.title}" by ${jukeboxInfo.nowPlaying.artist}. First voting round created.`;
    } else if (jukeboxInfo) {
      message = "🎵 Jukebox started! A random song is now playing and the first voting round has been created.";
    }

    const response = {
      success: true,
      message,
      data: {
        round,
        songs,
        jukebox: jukeboxInfo,
      },
    };
    
    // Add debug info in development
    if (jukeboxInfo && jukeboxInfo.votingRoundId && jukeboxInfo.votingRoundId !== round.id) {
      console.warn(`[createRound Controller] WARNING: Round ID mismatch! Returned round: ${round.id}, Voting round: ${jukeboxInfo.votingRoundId}`);
      // Include the voting round ID in the response for debugging
      response.data._debug = {
        returnedRoundId: round.id,
        votingRoundId: jukeboxInfo.votingRoundId,
        note: "The returned round ID may not match the voting round ID in the jukebox",
      };
    }
    
    return res.status(201).json(response);
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

    // Check jukebox status to see which round is the active voting round
    const jukeboxService = require("../services/jukeboxService");
    const jukebox = jukeboxService.getJukeboxStatus(ownerId);
    const activeVotingRoundId = jukebox?.votingRound?.roundId;
    
    console.log(`[getMyRounds] Owner: ${ownerId}, Total rounds: ${rounds.length}, Active voting round: ${activeVotingRoundId}`);

    // Add song count and vote count for each round
    const roundsWithStats = rounds.map((round) => {
      const songs = votingService.getSongsByRound(round.id, round.currentRoundNumber);
      const results = votingService.getVotingResults(round.id, round.currentRoundNumber);
      const isActiveVotingRound = round.id === activeVotingRoundId;
      
      if (isActiveVotingRound) {
        console.log(`[getMyRounds] Round ${round.id} is the active voting round in jukebox`);
      }
      
      return {
        ...round,
        songCount: songs.length,
        totalVotes: results.totalVotes,
        winner: results.winner,
        _isJukeboxVotingRound: isActiveVotingRound, // Debug flag
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

    const result = await votingService.generateNextRound(roundId);
    
    // Handle case where jukebox was auto-started (returns early with voting round)
    if (result.jukeboxAutoStarted) {
      return res.status(200).json({
        success: true,
        message: "Next round generated successfully and jukebox started automatically",
        data: {
          round: result.round,
          songs: result.songs,
          jukeboxStarted: true,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Next round generated successfully",
      data: {
        round: result.round,
        songs: result.songs,
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
 * Get countdown info for a round (public)
 * Returns time remaining if round is part of a jukebox
 */
async function getRoundCountdown(req, res) {
  try {
    const { roundId } = req.params;
    
    // Check if round exists
    const round = votingService.getRoundById(roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Round not found",
      });
    }

    // Check if round is part of a jukebox
    const countdown = jukeboxService.getRoundCountdown(roundId);
    
    if (countdown) {
      console.log(`[Countdown API] Returning countdown for round ${roundId}:`, {
        isJukeboxRound: countdown.isJukeboxRound,
        timeRemainingSeconds: countdown.timeRemainingSeconds,
        durationMs: countdown.durationMs,
      });
      return res.status(200).json({
        success: true,
        data: countdown,
      });
    }

    // Round is not part of a jukebox - return no countdown
    console.log(`[Countdown API] Round ${roundId} is not part of a jukebox`);
    return res.status(200).json({
      success: true,
      data: {
        isJukeboxRound: false,
        timeRemainingMs: null,
        timeRemainingSeconds: null,
      },
    });
  } catch (error) {
    console.error("Error getting round countdown:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error getting round countdown",
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

    // Generate voting page URL - use request origin if available, otherwise fall back to env var or localhost
    let frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    
    // Try to detect frontend URL from request origin (for production)
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        // Use the origin's protocol and host for the frontend URL
        frontendUrl = `${originUrl.protocol}//${originUrl.host}`;
      } catch (e) {
        // If origin parsing fails, fall back to default
        console.warn("Failed to parse origin header, using default frontend URL");
      }
    }
    
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
  getRoundCountdown,
};
