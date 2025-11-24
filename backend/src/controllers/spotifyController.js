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
    const statusCode = error.message.includes("authentication") ? 401 : 
                      error.message.includes("not found") ? 404 : 400;
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

    const { scopes } = req.query;
    const scopesArray = scopes ? scopes.split(",") : undefined;

    // Include user ID in state parameter so we can identify the user in callback
    const state = userId;

    const authURL = spotifyService.getAuthorizationURL(
      state,
      scopesArray
    );

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
        spotifyMessages.spotifyOAuthError(error) || "Spotify authorization failed"
      );
      return res.redirect(`${redirectBase}?spotify=error&message=${errorMessage}`);
    }

    // Check if authorization code is present
    if (!code) {
      const errorMessage = encodeURIComponent(
        spotifyMessages.authorizationCodeRequired || "Authorization code is required"
      );
      return res.redirect(`${redirectBase}?spotify=error&message=${errorMessage}`);
    }

    // Extract user ID from state parameter
    const userId = state;
    if (!userId) {
      const errorMessage = encodeURIComponent("User ID not found in OAuth state");
      return res.redirect(`${redirectBase}?spotify=error&message=${errorMessage}`);
    }

    // Exchange authorization code for access token
    const tokenData = await spotifyService.exchangeCodeForToken(code);

    // Calculate expiration time
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

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
      error.message || spotifyMessages.errorHandlingSpotifyOAuthCallback || "Failed to connect to Spotify"
    );
    return res.redirect(`${frontendUrl}/dashboard?spotify=error&message=${errorMessage}`);
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
    const expiresIn = tokens.expiresAt ? Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000)) : null;

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
module.exports = {
  getSpotifyTrack,
  searchSpotifyTracks,
  initiateOAuth,
  handleOAuthCallback,
  getSpotifyToken,
};
