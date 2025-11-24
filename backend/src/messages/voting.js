// Voting messages
const votingMessages = {
  votingRoundCreatedSuccessfully: "Voting round created successfully",
  errorCreatingVotingRound: "Error creating voting round",
  errorFetchingRounds: "Error fetching rounds",
  roundNotFound: "Round not found",
  errorFetchingRound: "Error fetching round",
  songIdRequired: "songId is required",
  voteUpdated: "Vote updated",
  voteSubmitted: "Vote submitted",
  errorSubmittingVote: "Error submitting vote",
  errorFetchingResults: "Error fetching results",
  onlyOwnerCanGenerateNextRound: "Only the round owner can generate the next round",
  nextRoundGeneratedSuccessfully: "Next round generated successfully",
  errorGeneratingNextRound: "Error generating next round",
  statusRequired: "Status is required",
  onlyOwnerCanUpdateStatus: "Only the round owner can update the status",
  roundStatusUpdated: (status) => `Round status updated to ${status}`,
  errorUpdatingRoundStatus: "Error updating round status",
  errorFetchingSpotifyTrack: "Error fetching Spotify track",
  searchQueryRequired: "Search query (q) is required",
  errorSearchingSpotifyTracks: "Error searching Spotify tracks",
  onlyOwnerCanAccessQrCode: "Only the round owner can access QR code",
  errorGeneratingQrCode: "Error generating QR code",
};

module.exports = votingMessages;

