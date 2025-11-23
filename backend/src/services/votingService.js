const aiService = require("./aiService");
const crypto = require("crypto");
const jukeboxService = require("./jukeboxService");
const spotifyService = require("./spotifyService");

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
 * @param {string} ownerId - Owner user ID
 * @param {Object} roundData - Round criteria (genre, bpm, artists, mood, energy)
 * @param {boolean} skipAutoStart - If true, skip auto-starting jukebox (for internal use)
 */
async function createRound(ownerId, roundData, skipAutoStart = false) {
  // NEW FLOW: Auto-start jukebox with random song, which will create the voting round
  if (!skipAutoStart) {
    console.log(`[CreateRound] Starting createRound for owner ${ownerId}, skipAutoStart: ${skipAutoStart}`);
    console.log(`[CreateRound] jukeboxService available:`, typeof jukeboxService !== 'undefined' && jukeboxService !== null);
    try {
      // Check if jukebox already exists for this owner
      const existingJukebox = jukeboxService.getJukeboxStatus(ownerId);
      console.log(`[CreateRound] Existing jukebox check:`, {
        exists: !!existingJukebox,
        isActive: existingJukebox?.isActive,
      });
      if (!existingJukebox || !existingJukebox.isActive) {
        // Start jukebox with random song - this will create the voting round automatically
        console.log(`🎵 Auto-starting jukebox for owner ${ownerId} with random song`);
        console.log(`[CreateRound] Calling startJukeboxWithRandomSong with roundData:`, roundData);
        try {
          await jukeboxService.startJukeboxWithRandomSong(ownerId, roundData);
          console.log(`✅ Jukebox started with random song - startJukeboxWithRandomSong completed`);
        } catch (jukeboxError) {
          console.error(`[CreateRound] ERROR in startJukeboxWithRandomSong:`, jukeboxError);
          console.error(`[CreateRound] Error message:`, jukeboxError.message);
          console.error(`[CreateRound] Error stack:`, jukeboxError.stack);
          throw jukeboxError; // Re-throw to be caught by outer catch
        }
        
        // Get the voting round that was created by jukebox
        // Wait a tiny bit to ensure the round is fully added to votingRounds
        await new Promise(resolve => setImmediate(resolve));
        
        const jukebox = jukeboxService.getJukeboxStatus(ownerId);
        console.log(`[CreateRound] Jukebox status after start:`, {
          isActive: jukebox?.isActive,
          hasVotingRound: !!jukebox?.votingRound,
          votingRoundId: jukebox?.votingRound?.roundId,
          nowPlaying: jukebox?.nowPlaying?.song?.title,
        });
        
        if (jukebox && jukebox.isActive && jukebox.votingRound) {
          // Return the voting round that was created by jukebox
          // Try multiple times in case of timing issues
          let votingRound = null;
          const votingRoundId = jukebox.votingRound.roundId;
          
          console.log(`[CreateRound] Looking for voting round: ${votingRoundId}`);
          console.log(`[CreateRound] Current votingRounds array length: ${votingRounds.length}`);
          console.log(`[CreateRound] Current votingRounds IDs:`, votingRounds.map(r => r.id));
          
          for (let i = 0; i < 5; i++) {
            votingRound = getRoundById(votingRoundId);
            if (votingRound) {
              console.log(`[CreateRound] Found voting round on attempt ${i + 1}`);
              break;
            }
            console.log(`[CreateRound] Attempt ${i + 1} failed, waiting...`);
            if (i < 4) await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          if (votingRound) {
            console.log(`[CreateRound] Returning voting round: ${votingRound.id}`);
            console.log(`[CreateRound] Now playing song: "${jukebox.nowPlaying?.song?.title}" by ${jukebox.nowPlaying?.song?.artist}`);
            // Attach jukebox info to the round for the response
            votingRound._jukeboxInfo = {
              isActive: true,
              nowPlaying: jukebox.nowPlaying?.song,
              votingRoundId: jukebox.votingRound.roundId,
            };
            return votingRound;
          } else {
            console.error(`[CreateRound] Voting round ${votingRoundId} not found in votingRounds after ${5} retries`);
            console.error(`[CreateRound] Available rounds:`, votingRounds.map(r => r.id));
            console.error(`[CreateRound] Jukebox says voting round ID is: ${votingRoundId}`);
            // Don't fall through - throw error so we know something is wrong
            throw new Error(`Voting round ${votingRoundId} not found after jukebox start`);
          }
        } else {
          console.warn(`[CreateRound] Jukebox started but voting round not found`);
          console.warn(`[CreateRound] Jukebox state:`, {
            exists: !!jukebox,
            isActive: jukebox?.isActive,
            hasVotingRound: !!jukebox?.votingRound,
            votingRoundId: jukebox?.votingRound?.roundId,
          });
          throw new Error(`Jukebox started but voting round not found`);
        }
      } else {
        console.log(`ℹ️  Jukebox already active, creating voting round normally`);
      }
    } catch (error) {
      console.error(`⚠️  Failed to auto-start jukebox:`, error);
      console.error(`⚠️  Error details:`, error.message);
      console.error(`⚠️  Error stack:`, error.stack);
      console.warn(`⚠️  Creating round normally as fallback`);
      // Continue with normal round creation if jukebox start fails
    }
  } else {
    console.log(`ℹ️  Skipping auto-start (internal call)`);
  }

  // Fallback: Normal round creation (if jukebox start failed or already active)
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

  // Generate initial 10 songs using AI for voting
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

    prompt += `\n\nYou are a Spotify DJ Voting Agent. Your role is to generate dynamic Spotify song recommendations based on user votes, preferences, and genre trends.

IMPORTANT: You must return ONLY a valid JSON array with exactly 10 objects. Do not include any markdown formatting, code blocks, or explanatory text. Just the raw JSON array.

Song Selection Criteria:
- 70-80% songs similar to the last few winners (if previous round data provided)
- 20-30% new or surprising additions for exploration
- Never repeat the same track within a session
- Avoid more than two songs from the same artist in one round
- Keep recommendations coherent with the crowd's preferences but introduce variety

Each object in the array must have these exact fields:
- title: (string) Song title - use real, popular song titles
- artist: (string) Artist name - use real, popular artist names  
- spotifyId: (string) Spotify track ID if available, or null
- spotifyUri: (string) Spotify URI (format: spotify:track:ID) if available, or null
- genre: (string) Genre of the song
- bpm: (number) Beats per minute

Example format:
[
  {"title": "Song Title 1", "artist": "Artist Name 1", "spotifyId": "track_id_1", "spotifyUri": "spotify:track:track_id_1", "genre": "Pop", "bpm": 120},
  {"title": "Song Title 2", "artist": "Artist Name 2", "spotifyId": "track_id_2", "spotifyUri": "spotify:track:track_id_2", "genre": "Pop", "bpm": 125}
]

Return ONLY the JSON array starting with [ and ending with ]. No other text.`;

    const response = await aiService.sendMessage({
      messages: [
        {
          role: "system",
          content: "You are a music recommendation assistant. You must always respond with valid JSON arrays. Never include markdown code blocks or explanatory text - only raw JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2500, // Increased to ensure full response
    });

    // Parse AI response
    let aiResponseText = "";
    if (response.choices && response.choices[0]) {
      aiResponseText = response.choices[0].message?.content || "";
    } else if (response.content) {
      aiResponseText = response.content;
    } else {
      // Log the full response structure if it doesn't match expected format
      console.error("⚠️  AI response structure unexpected. Full response:", JSON.stringify(response, null, 2));
    }

    // Check if we got any response text
    if (!aiResponseText || aiResponseText.trim().length === 0) {
      console.error("❌ AI returned empty response. Full response object:", JSON.stringify(response, null, 2));
      return generateFallbackSongs(round);
    }

    console.log("✅ AI Response received (first 200 chars):", aiResponseText.substring(0, 200));

    // Try to extract JSON from response
    let songList = [];
    try {
      // Remove markdown code blocks if present
      aiResponseText = aiResponseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      // Try to find JSON array in the response
      const jsonMatch = aiResponseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        songList = JSON.parse(jsonMatch[0]);
        console.log(`✅ Successfully parsed ${songList.length} songs from AI response`);
      } else {
        // Try parsing the whole response
        songList = JSON.parse(aiResponseText);
        console.log(`✅ Successfully parsed ${songList.length} songs from AI response (direct parse)`);
      }
    } catch (parseError) {
      console.error("❌ Failed to parse AI response as JSON:", parseError.message);
      console.error("📝 AI Response (first 500 chars):", aiResponseText.substring(0, 500));
      console.error("📝 Full AI Response:", aiResponseText);
      // Fallback: generate placeholder songs
      songList = generateFallbackSongs(round);
    }

    // Ensure we have exactly 10 songs
    if (!Array.isArray(songList) || songList.length === 0) {
      console.error("❌ Song list is not an array or is empty. Got:", typeof songList, songList);
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
    console.error("❌ Error generating songs with AI:", error.message);
    console.error("📋 Error stack:", error.stack);
    if (error.response) {
      console.error("📋 AI Service Error Response:", JSON.stringify(error.response.data, null, 2));
    }
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
 * @param {string} roundId - The round ID
 * @param {boolean} skipAutoStart - If true, skip auto-starting jukebox (used when called from jukebox service)
 */
async function generateNextRound(roundId, skipAutoStart = false) {
  const round = getRoundById(roundId);
  if (!round) {
    throw new Error("Round not found");
  }

  // Get previous round results (before incrementing)
  const previousRoundNumber = round.currentRoundNumber;
  const previousResults = getVotingResults(roundId, previousRoundNumber);
  const previousVotes = votes.filter(
    (v) => v.roundId === roundId && v.roundNumber === previousRoundNumber
  );

  // Auto-start jukebox if not already active and previous round has a winner
  // This happens when generating the first "next round" - automatically start jukebox session
  // IMPORTANT: Do this BEFORE incrementing round number so jukebox uses correct round
  // Skip if called from jukebox service to avoid double-generation
  if (!skipAutoStart && previousResults.winner && previousResults.totalVotes > 0) {
    try {
      // Check if jukebox is already active for this owner
      const existingJukebox = jukeboxService.getJukeboxStatus(round.ownerId);
      if (!existingJukebox || !existingJukebox.isActive) {
        // Start jukebox with the current round (before incrementing)
        // The jukebox will use the winner from previousResults and generate its own next round
        console.log(`🎵 Auto-starting jukebox for owner ${round.ownerId} with round ${roundId} (round ${previousRoundNumber})`);
        await jukeboxService.startJukebox(round.ownerId, roundId);
        console.log(`✅ Jukebox auto-started successfully`);
        // Jukebox start will generate the next round, so we can return early
        // But we need to return the round that was just generated by jukebox
        const jukebox = jukeboxService.getJukeboxStatus(round.ownerId);
        if (jukebox && jukebox.votingRound) {
          const votingRound = getRoundById(jukebox.votingRound.roundId);
          const votingRoundSongs = getSongsByRound(jukebox.votingRound.roundId, jukebox.votingRound.roundNumber);
          return {
            round: votingRound,
            songs: votingRoundSongs,
            jukeboxAutoStarted: true,
          };
        }
      } else {
        console.log(`ℹ️  Jukebox already active for owner ${round.ownerId}, skipping auto-start`);
      }
    } catch (error) {
      // Don't fail the round generation if jukebox start fails
      console.warn(`⚠️  Failed to auto-start jukebox: ${error.message}`);
    }
  }

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

// Internal helper functions to break circular dependency with jukeboxService
function _internalAddRound(round) {
  votingRounds.push(round);
}

function _internalAddSong(song) {
  songs.push(song);
}

function _internalGenerateSongsWithAI(round, previousRoundData, previousVotes) {
  return generateSongsWithAI(round, previousRoundData, previousVotes);
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
  generateId, // Export for use in jukeboxService
  _internalAddRound,
  _internalAddSong,
  _internalGenerateSongsWithAI,
};
