const spotifyService = require("../services/spotifyService");

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
      message: error.message || "Error initiating Spotify OAuth",
    });
  }
}

/**
 * Handle Spotify OAuth callback
 */
async function handleOAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: `Spotify OAuth error: ${error}`,
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required",
      });
    }

    const tokenData = await spotifyService.exchangeCodeForToken(code);

    spotifyService.accessToken = tokenData.access_token;
    spotifyService.refreshToken = tokenData.refresh_token;
    spotifyService.expiresIn = tokenData.expires_in;
    spotifyService.tokenType = tokenData.token_type;
    spotifyService.scope = tokenData.scope;
    spotifyService.state = state || null;

    console.log("Token data:", tokenData);
    


    return res.status(200).json({
      success: true,
      message: "Spotify OAuth successful",
      data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        state: state || null,
      },
    });
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error handling Spotify OAuth callback",
    });
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
