const aiService = require("./aiService");
const crypto = require("crypto");

// In-memory storage (replace with database in production)
const votingRounds = [];
const songs = [];
const votes = [];

/**
 * Generate unique ID
 */
function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Create a new voting round
 */
async function createRound(ownerId, roundData) {
  const roundId = generateId();
  const round = {
    id: roundId,
    ownerId,
    status: "active", // active, completed, paused
    genre: roundData.genre || null,
    bpm: roundData.bpm || null,
    artists: roundData.artists || [],
    mood: roundData.mood || null,
    energy: roundData.energy || null,
    currentRoundNumber: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  votingRounds.push(round);

  // Generate initial 10 songs using AI
  const initialSongs = await generateSongsWithAI(round, null, null);
  
  // Add songs to the round
  initialSongs.forEach((song, index) => {
    songs.push({
      id: generateId(),
      roundId,
      roundNumber: 1,
      title: song.title,
      artist: song.artist,
      spotifyId: song.spotifyId || null,
      spotifyUri: song.spotifyUri || null,
      votes: 0,
      order: index + 1,
      genre: song.genre || round.genre,
      bpm: song.bpm || round.bpm,
      createdAt: new Date().toISOString(),
    });
  });

  return round;
}

/**
 * Generate songs using AI agent
 */
async function generateSongsWithAI(round, previousRoundData, previousVotes) {
  try {
    // Build prompt for AI agent
    let prompt = `Generate a list of exactly 10 song recommendations for a DJ voting round. `;

    if (round.genre) {
      prompt += `Genre: ${round.genre}. `;
    }
    if (round.bpm) {
      prompt += `BPM range: around ${round.bpm}. `;
    }
    if (round.artists && round.artists.length > 0) {
      prompt += `Prefer songs by or similar to: ${round.artists.join(", ")}. `;
    }
    if (round.mood) {
      prompt += `Mood: ${round.mood}. `;
    }
    if (round.energy) {
      prompt += `Energy level: ${round.energy}. `;
    }

    if (previousRoundData) {
      // Analyze previous voting patterns
      const winner = previousRoundData.winner;
      if (winner) {
        prompt += `\nPrevious round winner: "${winner.title}" by ${winner.artist} with ${winner.votes} votes. `;
      }
      prompt += `Total votes in previous round: ${previousRoundData.totalVotes || 0}. `;
      prompt += `Analyze the voting patterns and user preferences to generate better recommendations for this round. `;
      prompt += `Consider that users preferred songs similar to the winner and generate complementary recommendations.`;
    }

    prompt += `\n\nReturn the response as a JSON array with exactly 10 objects. Each object must have:
- title: (string) Song title
- artist: (string) Artist name
- spotifyId: (string) Spotify track ID if available, or null
- spotifyUri: (string) Spotify URI (format: spotify:track:ID) if available, or null
- genre: (string) Genre of the song
- bpm: (number) Beats per minute

Return ONLY the JSON array, no additional text or markdown formatting.`;

    const response = await aiService.sendMessage({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    // Parse AI response
    let aiResponseText = "";
    if (response.choices && response.choices[0]) {
      aiResponseText = response.choices[0].message?.content || "";
    } else if (response.content) {
      aiResponseText = response.content;
    }

    // Try to extract JSON from response
    let songList = [];
    try {
      // Remove markdown code blocks if present
      aiResponseText = aiResponseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      // Try to find JSON array in the response
      const jsonMatch = aiResponseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        songList = JSON.parse(jsonMatch[0]);
      } else {
        songList = JSON.parse(aiResponseText);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("AI Response:", aiResponseText);
      // Fallback: generate placeholder songs
      songList = generateFallbackSongs(round);
    }

    // Ensure we have exactly 10 songs
    if (!Array.isArray(songList) || songList.length === 0) {
      songList = generateFallbackSongs(round);
    }

    // Pad or trim to exactly 10 songs
    while (songList.length < 10) {
      songList.push({
        title: `Generated Song ${songList.length + 1}`,
        artist: "Various Artists",
        spotifyId: null,
        spotifyUri: null,
        genre: round.genre || "Pop",
        bpm: round.bpm || 120,
      });
    }

    return songList.slice(0, 10);
  } catch (error) {
    console.error("Error generating songs with AI:", error);
    // Fallback to default songs if AI fails
    return generateFallbackSongs(round);
  }
}

/**
 * Generate fallback songs if AI fails
 */
function generateFallbackSongs(round) {
  const defaultSongs = [
    { title: "Song 1", artist: "Artist 1", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 2", artist: "Artist 2", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 3", artist: "Artist 3", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 4", artist: "Artist 4", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 5", artist: "Artist 5", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 6", artist: "Artist 6", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 7", artist: "Artist 7", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 8", artist: "Artist 8", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 9", artist: "Artist 9", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
    { title: "Song 10", artist: "Artist 10", spotifyId: null, spotifyUri: null, genre: round.genre || "Pop", bpm: round.bpm || 120 },
  ];
  return defaultSongs;
}

/**
 * Get round by ID
 */
function getRoundById(roundId) {
  return votingRounds.find((r) => r.id === roundId);
}

/**
 * Get rounds by owner
 */
function getRoundsByOwner(ownerId) {
  return votingRounds.filter((r) => r.ownerId === ownerId);
}

/**
 * Get songs for a round
 */
function getSongsByRound(roundId, roundNumber = null) {
  let roundSongs = songs.filter((s) => s.roundId === roundId);
  if (roundNumber !== null) {
    roundSongs = roundSongs.filter((s) => s.roundNumber === roundNumber);
  }
  return roundSongs.sort((a, b) => a.order - b.order);
}

/**
 * Submit a vote
 */
function submitVote(roundId, songId, participantToken = null) {
  const round = getRoundById(roundId);
  if (!round || round.status !== "active") {
    throw new Error("Round not found or not active");
  }

  const song = songs.find((s) => s.id === songId && s.roundId === roundId);
  if (!song) {
    throw new Error("Song not found in this round");
  }

  // Generate participant token if not provided
  if (!participantToken) {
    participantToken = generateId();
  }

  // Check if participant already voted in this round
  const existingVote = votes.find(
    (v) => v.roundId === roundId && v.roundNumber === song.roundNumber && v.participantToken === participantToken
  );

  if (existingVote) {
    // Update existing vote
    const oldSong = songs.find((s) => s.id === existingVote.songId);
    if (oldSong) {
      oldSong.votes = Math.max(0, oldSong.votes - 1);
    }

    existingVote.songId = songId;
    existingVote.updatedAt = new Date().toISOString();
  } else {
    // Create new vote
    votes.push({
      id: generateId(),
      roundId,
      roundNumber: song.roundNumber,
      songId,
      participantToken,
      createdAt: new Date().toISOString(),
    });
  }

  // Increment song vote count
  song.votes = (song.votes || 0) + 1;

  return { participantToken, updated: !!existingVote };
}

/**
 * Get voting results for a round
 */
function getVotingResults(roundId, roundNumber = null) {
  const round = getRoundById(roundId);
  if (!round) {
    throw new Error("Round not found");
  }

  const roundSongs = getSongsByRound(roundId, roundNumber || round.currentRoundNumber);
  const roundVotes = votes.filter(
    (v) => v.roundId === roundId && (roundNumber === null || v.roundNumber === roundNumber)
  );

  const results = roundSongs.map((song) => ({
    songId: song.id,
    title: song.title,
    artist: song.artist,
    votes: song.votes || 0,
    spotifyId: song.spotifyId,
    spotifyUri: song.spotifyUri,
  }));

  // Sort by votes descending
  results.sort((a, b) => b.votes - a.votes);

  return {
    roundId,
    roundNumber: roundNumber || round.currentRoundNumber,
    totalVotes: roundVotes.length,
    songs: results,
    winner: results[0] || null,
  };
}

/**
 * Generate next round with AI
 */
async function generateNextRound(roundId) {
  const round = getRoundById(roundId);
  if (!round) {
    throw new Error("Round not found");
  }

  // Get previous round results
  const previousResults = getVotingResults(roundId, round.currentRoundNumber);
  const previousVotes = votes.filter(
    (v) => v.roundId === roundId && v.roundNumber === round.currentRoundNumber
  );

  // Increment round number
  round.currentRoundNumber += 1;
  round.updatedAt = new Date().toISOString();

  // Generate new songs using AI
  const newSongs = await generateSongsWithAI(round, previousResults, previousVotes);

  // Add new songs
  newSongs.forEach((song, index) => {
    songs.push({
      id: generateId(),
      roundId,
      roundNumber: round.currentRoundNumber,
      title: song.title,
      artist: song.artist,
      spotifyId: song.spotifyId || null,
      spotifyUri: song.spotifyUri || null,
      votes: 0,
      order: index + 1,
      genre: song.genre || round.genre,
      bpm: song.bpm || round.bpm,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    round,
    songs: getSongsByRound(roundId, round.currentRoundNumber),
  };
}

/**
 * Get winning song for a round
 */
function getWinningSong(roundId, roundNumber = null) {
  const results = getVotingResults(roundId, roundNumber);
  return results.winner;
}

/**
 * Update round status
 */
function updateRoundStatus(roundId, status) {
  const round = getRoundById(roundId);
  if (!round) {
    throw new Error("Round not found");
  }

  const validStatuses = ["active", "paused", "completed"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  round.status = status;
  round.updatedAt = new Date().toISOString();

  return round;
}

module.exports = {
  createRound,
  getRoundById,
  getRoundsByOwner,
  getSongsByRound,
  submitVote,
  getVotingResults,
  generateNextRound,
  getWinningSong,
  updateRoundStatus,
};
