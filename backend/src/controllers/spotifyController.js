const spotifyService = require("../services/spotifyService");
const spotifyMessages = require("../messages/spotify");
const authService = require("../services/authService");

/**
 * Get Spotify track info
 */
async function getSpotifyTrack(req, res) {
  try {
    const { trackId } = req.params;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        message: "Track ID is required",
      });
    }

    const track = await spotifyService.getTrack(trackId);

    return res.status(200).json({
      success: true,
      data: track,
    });
  } catch (error) {
    console.error("Error in getSpotifyTrack controller:", error.message);
    // Return more detailed error information
    const statusCode = error.message.includes("authentication")
      ? 401
      : error.message.includes("not found")
      ? 404
      : 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || spotifyMessages.errorFetchingSpotifyTrack,
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
        message: spotifyMessages.searchQueryRequired,
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
      message: error.message || spotifyMessages.errorSearchingSpotifyTracks,
    });
  }
}

/**
 * Initiate Spotify OAuth flow - redirect to Spotify authorization
 * Requires authentication - user must be logged in
 */
async function initiateOAuth(req, res) {
  try {
    // Get user ID from authenticated request
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to connect Spotify",
      });
    }

    const { scopes, format } = req.query;
    const scopesArray = scopes ? scopes.split(",") : undefined;

    // Include user ID in state parameter so we can identify the user in callback
    const state = userId.toString();

    const authURL = spotifyService.getAuthorizationURL(state, scopesArray);

    // If format=json is requested, return the URL as JSON (for frontend to handle redirect)
    if (format === "json") {
      return res.status(200).json({
        success: true,
        data: {
          authUrl: authURL,
        },
      });
    }

    // Otherwise, redirect directly (for direct browser access)
    return res.redirect(authURL);
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return res.status(400).json({
      success: false,
      message: error.message || spotifyMessages.errorInitiatingSpotifyOAuth,
    });
  }
}

/**
 * Handle Spotify OAuth callback
 */
async function handleOAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const redirectBase = `${frontendUrl}/dashboard`;

    // Handle OAuth errors from Spotify
    if (error) {
      console.error("Spotify OAuth error:", error);
      const errorMessage = encodeURIComponent(
        spotifyMessages.spotifyOAuthError(error) ||
          "Spotify authorization failed"
      );
      return res.redirect(
        `${redirectBase}?spotify=error&message=${errorMessage}`
      );
    }

    // Check if authorization code is present
    if (!code) {
      const errorMessage = encodeURIComponent(
        spotifyMessages.authorizationCodeRequired ||
          "Authorization code is required"
      );
      return res.redirect(
        `${redirectBase}?spotify=error&message=${errorMessage}`
      );
    }

    // Extract user ID from state parameter
    const userId = state;
    if (!userId) {
      const errorMessage = encodeURIComponent(
        "User ID not found in OAuth state"
      );
      return res.redirect(
        `${redirectBase}?spotify=error&message=${errorMessage}`
      );
    }

    // Exchange authorization code for access token
    const tokenData = await spotifyService.exchangeCodeForToken(code);

    // Calculate expiration time
    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    // Store tokens in database for this specific user
    await authService.updateUserSpotifyTokens(
      userId,
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt
    );

    console.log(`Spotify OAuth successful - tokens stored for user ${userId}`);

    // Redirect to frontend with success indicator
    return res.redirect(`${redirectBase}?spotify=connected`);
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const errorMessage = encodeURIComponent(
      error.message ||
        spotifyMessages.errorHandlingSpotifyOAuthCallback ||
        "Failed to connect to Spotify"
    );
    return res.redirect(
      `${frontendUrl}/dashboard?spotify=error&message=${errorMessage}`
    );
  }
}

/**
 * Get user's currently playing track on Spotify
 * Requires authentication and Spotify connection
 */
async function getCurrentlyPlaying(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get user's Spotify tokens from database
    const tokens = await authService.getUserSpotifyTokens(userId);
    if (!tokens || !tokens.accessToken) {
      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          playing: false,
          message: "Spotify not connected",
        },
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.accessToken;
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await spotifyService.refreshAccessToken(tokens.refreshToken);
          accessToken = refreshed.access_token;
          const newRefreshToken = refreshed.refresh_token || tokens.refreshToken;
          const newExpiresAt = Date.now() + (refreshed.expires_in * 1000);
          await authService.updateUserSpotifyTokens(
            userId,
            refreshed.access_token,
            newRefreshToken,
            newExpiresAt
          );
        } catch (error) {
          console.error("Failed to refresh token for playback:", error.message);
          return res.status(401).json({
            success: false,
            message: "Spotify authentication failed. Please reconnect to Spotify.",
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          message: "Spotify authentication expired. Please reconnect to Spotify.",
        });
      }
    }

    // Get current playback
    try {
      const playback = await spotifyService.getCurrentPlayback(accessToken);
      
      if (!playback || !playback.item) {
        return res.status(200).json({
          success: true,
          data: {
            connected: true,
            playing: false,
            message: "Nothing is currently playing",
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          connected: true,
          playing: playback.is_playing || false,
          track: {
            id: playback.item.id,
            name: playback.item.name,
            artist: playback.item.artists.map(a => a.name).join(", "),
            album: playback.item.album.name,
            uri: playback.item.uri,
            external_urls: playback.item.external_urls,
            images: playback.item.album.images,
          },
          progress_ms: playback.progress_ms || 0,
          duration_ms: playback.item.duration_ms || 0,
        },
      });
    } catch (error) {
      // Handle specific error cases gracefully
      if (error.message.includes("access denied") || error.message.includes("403")) {
        // Permission issue - return connected but can't read playback
        return res.status(200).json({
          success: true,
          data: {
            connected: true,
            playing: false,
            message: "Cannot read playback (permission issue)",
            error: "Spotify app permissions may need to be updated",
          },
        });
      } else if (error.message.includes("authentication failed") || error.message.includes("401")) {
        // Auth issue
        return res.status(200).json({
          success: true,
          data: {
            connected: false,
            playing: false,
            message: "Spotify authentication failed. Please reconnect.",
          },
        });
      } else if (error.message.includes("204") || error.response?.status === 204) {
        // No content = nothing is playing
        return res.status(200).json({
          success: true,
          data: {
            connected: true,
            playing: false,
            message: "Nothing is currently playing",
          },
        });
      }
      // For other errors, return a generic message but still indicate connection
      return res.status(200).json({
        success: true,
        data: {
          connected: true,
          playing: false,
          message: "Unable to get playback status",
          error: error.message,
        },
      });
    }
  } catch (error) {
    console.error("Error getting currently playing:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error getting currently playing track",
    });
  }
}

/**
 * Get current user's Spotify token information
 * Requires authentication
 */
async function getSpotifyToken(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get user's Spotify tokens from database
    const tokens = await authService.getUserSpotifyTokens(userId);

    if (!tokens) {
      return res.status(200).json({
        success: true,
        message: "User not connected to Spotify",
        data: {
          connected: false,
        },
      });
    }

    // Check if token is expired
    const isExpired = tokens.expiresAt && Date.now() >= tokens.expiresAt;
    const expiresIn = tokens.expiresAt
      ? Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000))
      : null;

    return res.status(200).json({
      success: true,
      message: "Spotify token retrieved successfully",
      data: {
        connected: true,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: expiresIn,
        expires_at: tokens.expiresAt,
        is_expired: isExpired,
      },
    });
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error getting Spotify token",
    });
  }
}
/**
 * Add a track to the user's Spotify queue
 * Requires authentication and Spotify connection
 */
async function addTrackToQueue(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { trackUri, trackId, deviceId } = req.body;

    // Validate input - need either trackUri or trackId
    if (!trackUri && !trackId) {
      return res.status(400).json({
        success: false,
        message: "Either trackUri or trackId is required",
      });
    }

    // Get user's Spotify tokens from database
    const tokens = await authService.getUserSpotifyTokens(userId);

    if (!tokens || !tokens.accessToken) {
      return res.status(400).json({
        success: false,
        message:
          "User not connected to Spotify. Please connect your Spotify account first.",
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.accessToken;
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await spotifyService.refreshAccessToken(
            tokens.refreshToken
          );
          accessToken = refreshed.access_token;
          // Use new refresh token if Spotify provided one, otherwise keep existing
          const newRefreshToken =
            refreshed.refresh_token || tokens.refreshToken;
          const newExpiresAt = Date.now() + refreshed.expires_in * 1000;
          await authService.updateUserSpotifyTokens(
            userId,
            refreshed.access_token,
            newRefreshToken,
            newExpiresAt
          );
        } catch (error) {
          console.error("Failed to refresh token for queue:", error.message);
          return res.status(401).json({
            success: false,
            message:
              "Spotify authentication failed. Please reconnect to Spotify.",
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          message:
            "Spotify authentication expired. Please reconnect to Spotify.",
        });
      }
    }

    // Convert trackId to trackUri if needed
    let finalTrackUri = trackUri;
    if (!finalTrackUri && trackId) {
      // If trackId is already a URI, use it; otherwise construct it
      if (trackId.startsWith("spotify:track:")) {
        finalTrackUri = trackId;
      } else {
        finalTrackUri = `spotify:track:${trackId}`;
      }
    }

    // Add track to queue
    try {
      await spotifyService.addToQueue(
        accessToken,
        finalTrackUri,
        deviceId || null
      );
      return res.status(200).json({
        success: true,
        message: "Track added to queue successfully",
      });
    } catch (error) {
      // Handle specific error cases
      if (error.message.includes("No active Spotify device")) {
        return res.status(404).json({
          success: false,
          message:
            "No active Spotify device found. Please open Spotify and start playing music.",
        });
      } else if (error.message.includes("Spotify Premium")) {
        return res.status(403).json({
          success: false,
          message: "Spotify Premium is required to add songs to queue.",
        });
      } else if (error.message.includes("authentication failed")) {
        return res.status(401).json({
          success: false,
          message:
            "Spotify authentication failed. Please reconnect to Spotify.",
        });
      }

      // Generic error
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to add track to queue",
      });
    }
  } catch (error) {
    console.error("Error adding track to queue:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

module.exports = {
  getSpotifyTrack,
  searchSpotifyTracks,
  initiateOAuth,
  handleOAuthCallback,
  getSpotifyToken,
  getCurrentlyPlaying,
  addTrackToQueue,
};
