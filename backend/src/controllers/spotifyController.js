const spotifyService = require("../services/spotifyService");
const spotifyMessages = require("../messages/spotify");

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

    if (error) {
      return res.status(400).json({
        success: false,
        message: spotifyMessages.spotifyOAuthError(error),
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: spotifyMessages.authorizationCodeRequired,
      });
    }

    const tokenData = await spotifyService.exchangeCodeForToken(code);

    return res.status(200).json({
      success: true,
      message: spotifyMessages.spotifyOAuthSuccessful,
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
      message: error.message || spotifyMessages.errorHandlingSpotifyOAuthCallback,
    });
  }
}

module.exports = {
  getSpotifyTrack,
  searchSpotifyTracks,
  initiateOAuth,
  handleOAuthCallback,
};
