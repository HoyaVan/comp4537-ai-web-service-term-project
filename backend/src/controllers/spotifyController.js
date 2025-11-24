const spotifyService = require("../services/spotifyService");
const spotifyMessages = require("../messages/spotify");

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
 */
async function initiateOAuth(req, res) {
  try {
    const { state, scopes } = req.query;
    const scopesArray = scopes ? scopes.split(",") : undefined;

    const authURL = spotifyService.getAuthorizationURL(
      state || null,
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

    // Exchange authorization code for access token
    const tokenData = await spotifyService.exchangeCodeForToken(code);

    // Store tokens in service (in-memory for now)
    spotifyService.accessToken = tokenData.access_token;
    spotifyService.refreshToken = tokenData.refresh_token;
    spotifyService.expiresIn = tokenData.expires_in;
    spotifyService.tokenType = tokenData.token_type;
    spotifyService.scope = tokenData.scope;
    spotifyService.state = state || null;
    // Calculate expiration time
    spotifyService.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

    console.log("Spotify OAuth successful - tokens stored");

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


async function setSpotifyToken(req, res) {
  try {
    
    return res.status(200).json({
      success: true,
      message: "Spotify token retrieved successfully",
      data: {
        access_token: spotifyService.accessToken,
        refresh_token: spotifyService.refreshToken,
        expires_in: spotifyService.expiresIn,
        token_type: spotifyService.tokenType,
        scope: spotifyService.scope,
        state: spotifyService.state,
      },
    });
  } catch (error) {
    console.error("Error setting Spotify token:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error setting Spotify token",
    });
  }
}
module.exports = {
  getSpotifyTrack,
  searchSpotifyTracks,
  initiateOAuth,
  handleOAuthCallback,
  setSpotifyToken,
};
