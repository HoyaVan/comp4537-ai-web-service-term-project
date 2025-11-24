// Spotify messages
const spotifyMessages = {
  errorFetchingSpotifyTrack: "Error fetching Spotify track",
  searchQueryRequired: "Search query (q) is required",
  errorSearchingSpotifyTracks: "Error searching Spotify tracks",
  errorInitiatingSpotifyOAuth: "Error initiating Spotify OAuth",
  spotifyOAuthError: (error) => `Spotify OAuth error: ${error}`,
  authorizationCodeRequired: "Authorization code is required",
  spotifyOAuthSuccessful: "Spotify OAuth successful",
  errorHandlingSpotifyOAuthCallback: "Error handling Spotify OAuth callback",
  // Service-level messages
  spotifyCredentialsNotConfigured: "Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET",
  failedToAuthenticateWithSpotify: "Failed to authenticate with Spotify",
  failedToSearchSpotifyTracks: "Failed to search Spotify tracks",
  failedToGetSpotifyTrack: "Failed to get Spotify track",
  failedToGetSpotifyTracks: "Failed to get Spotify tracks",
  spotifyClientIdNotConfigured: "Spotify client ID not configured",
  spotifyCallbackUriNotConfigured: "Spotify callback URI not configured",
  failedToExchangeCodeForToken: "Failed to exchange authorization code for token",
  failedToRefreshAccessToken: "Failed to refresh access token",
};

module.exports = spotifyMessages;

