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
};

module.exports = spotifyMessages;

