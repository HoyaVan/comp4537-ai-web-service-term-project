// Use lazy requires to avoid circular dependency issues
// We'll require these inside functions when needed
const spotifyService = require("./spotifyService");
const crypto = require("crypto");
const aiService = require("./aiService");

// Jukebox state for each owner
const jukeboxes = new Map(); // ownerId -> jukebox state

/**
 * Jukebox state structure:
 * {
 *   ownerId: string,
 *   isActive: boolean,
 *   nowPlaying: {
 *     roundId: string,
 *     roundNumber: number,
 *     song: { title, artist, spotifyId, spotifyUri, ... },
 *     startedAt: ISO timestamp,
 *     durationMs: number,
 *     endsAt: ISO timestamp
 *   },
 *   nextUp: {
 *     roundId: string,
 *     roundNumber: number,
 *     song: { title, artist, spotifyId, spotifyUri, ... },
 *   },
 *   votingRound: {
 *     roundId: string,
 *     roundNumber: number,
 *   },
 *   timer: NodeJS.Timeout | null
 * }
 */

/**
 * Generate fallback songs if AI fails (duplicated from votingService)
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
 * Generate songs with AI (duplicated from votingService to avoid circular dependency)
 */
async function generateSongsWithAI(round, previousRoundData, previousVotes) {
  try {
    let prompt = `Generate a list of exactly 10 song recommendations for a DJ voting round. `;
    if (round.genre) prompt += `Genre: ${round.genre}. `;
    if (round.bpm) prompt += `BPM range: around ${round.bpm}. `;
    if (round.artists && round.artists.length > 0) {
      prompt += `Prefer songs by or similar to: ${round.artists.join(", ")}. `;
    }
    if (round.mood) prompt += `Mood: ${round.mood}. `;
    if (round.energy) prompt += `Energy level: ${round.energy}. `;
    
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
      max_tokens: 2500,
    });

    // Parse AI response
    let aiResponseText = "";
    if (response.choices && response.choices[0]) {
      aiResponseText = response.choices[0].message?.content || "";
    } else if (response.content) {
      aiResponseText = response.content;
    } else {
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
 * Start jukebox mode with a random song (new flow)
 * Picks a random song from Spotify based on criteria and starts playing
 */
async function startJukeboxWithRandomSong(ownerId, roundData) {
  console.log(`[startJukeboxWithRandomSong] Starting jukebox for owner ${ownerId} with data:`, {
    genre: roundData.genre,
    mood: roundData.mood,
    artists: roundData.artists,
  });
  try {
    // Search Spotify for a random song based on criteria
    let searchQuery = "";
    if (roundData.genre) {
      // Use genre as a keyword search (Spotify doesn't support genre: filter in search)
      searchQuery += `${roundData.genre} `;
    }
    if (roundData.artists && roundData.artists.length > 0) {
      searchQuery += `artist:${roundData.artists[0]} `;
    }
    if (roundData.mood) {
      searchQuery += roundData.mood + " ";
    }
    
    // If no specific criteria, use a general popular search
    if (!searchQuery.trim()) {
      searchQuery = "popular";
    }

    // Search Spotify for tracks
    let randomTrack = null;
    try {
      console.log(`[startJukeboxWithRandomSong] Searching Spotify with query: "${searchQuery.trim()}"`);
      const tracks = await spotifyService.searchTracks(searchQuery.trim(), 50);
      console.log(`[startJukeboxWithRandomSong] Spotify returned ${tracks?.length || 0} tracks`);
      if (tracks && tracks.length > 0) {
        // Pick a random track from results
        const randomIndex = Math.floor(Math.random() * tracks.length);
        randomTrack = tracks[randomIndex];
        console.log(`🎲 Selected random song: "${randomTrack.name}" by ${randomTrack.artist} (ID: ${randomTrack.id})`);
      } else {
        console.warn(`[startJukeboxWithRandomSong] No tracks returned from Spotify search`);
      }
    } catch (error) {
      console.error(`[startJukeboxWithRandomSong] Failed to get random song from Spotify:`, error);
      console.warn("Using fallback song");
    }

    // Fallback if Spotify search fails
    if (!randomTrack) {
      // Use a default popular song or create a placeholder
      randomTrack = {
        id: null,
        uri: null,
        name: "Welcome Song",
        artist: "Various Artists",
        duration_ms: 180000, // 3 minutes default
      };
      console.log("⚠️  Using fallback song (Spotify unavailable)");
    }

    // Create a temporary "now playing" round entry
    const now = new Date();
    const durationMs = randomTrack.duration_ms || 180000;
    const startedAt = now.toISOString();
    const endsAt = new Date(now.getTime() + durationMs).toISOString();

    // Create jukebox state with random song
    const jukebox = {
      ownerId,
      isActive: true,
      nowPlaying: {
        roundId: null, // No round yet - this is the initial random song
        roundNumber: 0,
        song: {
          id: randomTrack.id,
          title: randomTrack.name,
          artist: randomTrack.artist,
          spotifyId: randomTrack.id,
          spotifyUri: randomTrack.uri,
        },
        startedAt,
        durationMs,
        endsAt,
      },
      nextUp: null,
      votingRound: null,
      timer: null,
      initialCriteria: roundData, // Store criteria for generating first voting round
    };

    // Generate first voting round
    // Use internal helper functions to avoid circular dependency
    console.log(`[startJukeboxWithRandomSong] Creating voting round using internal helpers`);
    
    // Generate round ID using crypto directly (avoid circular dependency issue)
    const roundId = crypto.randomBytes(16).toString("hex");
    const round = {
      id: roundId,
      ownerId,
      status: "active",
      genre: roundData.genre || null,
      bpm: roundData.bpm || null,
      artists: roundData.artists || [],
      mood: roundData.mood || null,
      energy: roundData.energy || null,
      currentRoundNumber: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Generate songs using AI (duplicate logic to avoid circular dependency)
    const initialSongs = await generateSongsWithAI(round, null, null);
    
    // Add round to storage using lazy require to avoid circular dependency
    console.log(`[startJukeboxWithRandomSong] Adding round ${round.id} to votingRounds`);
    // Use lazy require - get votingService after it's fully loaded
    const votingServiceLazy = require("./votingService");
    
    // Use setImmediate to ensure votingService is fully initialized
    await new Promise((resolve) => setImmediate(resolve));
    
    // Try to access the internal functions
    if (typeof votingServiceLazy._internalAddRound === 'function') {
      votingServiceLazy._internalAddRound(round);
    } else {
      console.error(`[startJukeboxWithRandomSong] _internalAddRound is not a function. Available exports:`, Object.keys(votingServiceLazy));
      throw new Error(`_internalAddRound is not available - circular dependency issue`);
    }
    
    // Verify it was added
    const verifyAfterAdd = votingServiceLazy.getRoundById(round.id);
    console.log(`[startJukeboxWithRandomSong] Round ${round.id} exists after add:`, !!verifyAfterAdd);
    if (!verifyAfterAdd) {
      console.error(`[startJukeboxWithRandomSong] CRITICAL: Round ${round.id} not found after adding!`);
      throw new Error(`Failed to add round ${round.id} to votingRounds`);
    }
    
    // Add songs to storage using lazy require
    initialSongs.forEach((song, index) => {
      if (typeof votingServiceLazy._internalAddSong === 'function') {
        votingServiceLazy._internalAddSong({
          id: crypto.randomBytes(16).toString("hex"),
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
      } else {
        console.error(`[startJukeboxWithRandomSong] _internalAddSong is not a function for song ${index + 1}`);
        throw new Error(`_internalAddSong is not available - circular dependency issue`);
      }
    });
    
    const votingRound = round;
    console.log(`[startJukeboxWithRandomSong] Voting round created: ${votingRound.id}`);
    
    // Verify the round exists (use lazy require)
    const votingServiceLazy1 = require("./votingService");
    const verifyRound = votingServiceLazy1.getRoundById(votingRound.id);
    if (!verifyRound) {
      console.error(`[startJukeboxWithRandomSong] ERROR: Voting round ${votingRound.id} not found after creation!`);
      throw new Error(`Voting round ${votingRound.id} not found after creation`);
    } else {
      console.log(`[startJukeboxWithRandomSong] Verified: Voting round ${votingRound.id} exists in votingService`);
    }
    
    jukebox.votingRound = {
      roundId: votingRound.id,
      roundNumber: votingRound.currentRoundNumber,
    };
    
    console.log(`[startJukeboxWithRandomSong] Jukebox voting round set:`, {
      roundId: jukebox.votingRound.roundId,
      roundNumber: jukebox.votingRound.roundNumber,
    });

    // Set up timer to check when song ends
    setupJukeboxTimer(jukebox);

    jukeboxes.set(ownerId, jukebox);
    console.log(`🎵 Jukebox started with random song: "${jukebox.nowPlaying.song.title}"`);
    console.log(`🗳️  First voting round created: ${votingRound.id}`);
    console.log(`[startJukeboxWithRandomSong] Jukebox state saved:`, {
      ownerId,
      votingRoundId: jukebox.votingRound.roundId,
      nowPlayingSong: jukebox.nowPlaying.song.title,
      isActive: jukebox.isActive,
    });
    
    // Verify jukebox was saved correctly
    const savedJukebox = jukeboxes.get(ownerId);
    console.log(`[startJukeboxWithRandomSong] Verification - saved jukebox:`, {
      exists: !!savedJukebox,
      isActive: savedJukebox?.isActive,
      votingRoundId: savedJukebox?.votingRound?.roundId,
      totalJukeboxes: jukeboxes.size,
    });
    
    // Final verification - check if countdown would work
    const testCountdown = getRoundCountdown(votingRound.id);
    if (testCountdown && testCountdown.isJukeboxRound) {
      console.log(`✅ [startJukeboxWithRandomSong] Countdown test PASSED for round ${votingRound.id}`);
    } else {
      console.error(`❌ [startJukeboxWithRandomSong] Countdown test FAILED for round ${votingRound.id}`);
      console.error(`   Countdown result:`, testCountdown);
    }
    
    // Return jukebox without timer (to avoid circular JSON error)
    const { timer, ...jukeboxResponse } = jukebox;
    return jukeboxResponse;
  } catch (error) {
    console.error("[startJukeboxWithRandomSong] ERROR starting jukebox with random song:", error);
    console.error("[startJukeboxWithRandomSong] Error stack:", error.stack);
    throw error;
  }
}

/**
 * Start jukebox mode for an owner (original method - for existing rounds with winners)
 */
async function startJukebox(ownerId, initialRoundId) {
  try {
    // Get or create initial round
    const votingServiceLazy2 = require("./votingService");
    let round = votingServiceLazy2.getRoundById(initialRoundId);
    if (!round) {
      throw new Error("Initial round not found");
    }

    // Get the winner of the initial round
    const results = votingServiceLazy2.getVotingResults(initialRoundId, round.currentRoundNumber);
    if (!results.winner) {
      throw new Error("No winner found for initial round. Ensure voting has completed.");
    }

    // Get winner song details
    const winnerSong = votingServiceLazy2.getSongsByRound(initialRoundId, round.currentRoundNumber)
      .find(s => s.id === results.winner.songId);

    if (!winnerSong) {
      throw new Error("Winner song not found");
    }

    // Get Spotify track info to get duration
    let durationMs = 180000; // Default 3 minutes if Spotify fails
    if (winnerSong.spotifyId) {
      try {
        const trackInfo = await spotifyService.getTrack(winnerSong.spotifyId);
        durationMs = trackInfo.duration_ms || durationMs;
      } catch (error) {
        console.warn("Failed to get Spotify track duration, using default:", error.message);
      }
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const endsAt = new Date(now.getTime() + durationMs).toISOString();

    // Create jukebox state
    const jukebox = {
      ownerId,
      isActive: true,
      nowPlaying: {
        roundId: initialRoundId,
        roundNumber: round.currentRoundNumber,
        song: {
          ...winnerSong,
          title: results.winner.title,
          artist: results.winner.artist,
          spotifyId: results.winner.spotifyId,
          spotifyUri: results.winner.spotifyUri,
        },
        startedAt,
        durationMs,
        endsAt,
      },
      nextUp: null,
      votingRound: null,
      timer: null,
    };

    // Generate first voting round for next song
    // Pass skipAutoStart=true to prevent recursive jukebox start
    const votingServiceLazy3 = require("./votingService");
    const { round: votingRound } = await votingServiceLazy3.generateNextRound(initialRoundId, true);
    jukebox.votingRound = {
      roundId: votingRound.id,
      roundNumber: votingRound.currentRoundNumber,
    };

    // Set up timer to check when song ends
    setupJukeboxTimer(jukebox);

    jukeboxes.set(ownerId, jukebox);
    console.log(`🎵 Jukebox started for owner ${ownerId}. Now playing: "${jukebox.nowPlaying.song.title}"`);
    
    // Return jukebox without timer (to avoid circular JSON error)
    const { timer, ...jukeboxResponse } = jukebox;
    return jukeboxResponse;
  } catch (error) {
    console.error("Error starting jukebox:", error);
    throw error;
  }
}

/**
 * Setup timer to automatically advance when song ends
 */
function setupJukeboxTimer(jukebox) {
  // Clear existing timer
  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
  }

  if (!jukebox.isActive || !jukebox.nowPlaying) {
    return;
  }

  const endsAt = new Date(jukebox.nowPlaying.endsAt);
  const now = new Date();
  const timeUntilEnd = endsAt.getTime() - now.getTime();

  if (timeUntilEnd <= 0) {
    // Song already ended, advance immediately
    advanceJukebox(jukebox.ownerId);
    return;
  }

  // Set timer to advance when song ends
  jukebox.timer = setTimeout(() => {
    advanceJukebox(jukebox.ownerId);
  }, timeUntilEnd);

  console.log(`⏰ Jukebox timer set: "${jukebox.nowPlaying.song.title}" will end in ${Math.round(timeUntilEnd / 1000)}s`);
}

/**
 * Advance jukebox to next song
 */
async function advanceJukebox(ownerId) {
  try {
    const jukebox = jukeboxes.get(ownerId);
    if (!jukebox || !jukebox.isActive) {
      return;
    }

    console.log(`🎵 Advancing jukebox for owner ${ownerId}...`);

    // Handle case where initial random song is playing (no voting round yet or roundId is null)
    if (!jukebox.votingRound || !jukebox.votingRound.roundId) {
      console.log("Initial random song ended, but no voting round yet. Waiting...");
      // If no voting round, we can't advance - this shouldn't happen in normal flow
      // but if it does, just wait a bit and try again
      setTimeout(() => advanceJukebox(ownerId), 5000);
      return;
    }

    // Get current voting round
    const votingServiceLazy4 = require("./votingService");
    const votingRound = votingServiceLazy4.getRoundById(jukebox.votingRound.roundId);
    if (!votingRound) {
      console.error("Voting round not found, stopping jukebox");
      stopJukebox(ownerId);
      return;
    }

    // Get winner of voting round
    const results = votingServiceLazy4.getVotingResults(
      jukebox.votingRound.roundId,
      jukebox.votingRound.roundNumber
    );

    // If no winner yet, use the song with most votes, or first song if no votes
    if (!results.winner || results.totalVotes === 0) {
      console.warn("No votes in voting round yet, using first song as default");
      const songs = votingServiceLazy4.getSongsByRound(
        jukebox.votingRound.roundId,
        jukebox.votingRound.roundNumber
      );
      if (songs.length === 0) {
        console.error("No songs in voting round, stopping jukebox");
        stopJukebox(ownerId);
        return;
      }
      // Use first song (or song with most votes if any)
      const topSong = songs.sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
      results.winner = {
        songId: topSong.id,
        title: topSong.title,
        artist: topSong.artist,
        spotifyId: topSong.spotifyId,
        spotifyUri: topSong.spotifyUri,
      };
    }

    // Get winner song details
    const winnerSong = votingServiceLazy4.getSongsByRound(
      jukebox.votingRound.roundId,
      jukebox.votingRound.roundNumber
    ).find(s => s.id === results.winner.songId);

    if (!winnerSong) {
      console.error("Winner song not found, stopping jukebox");
      stopJukebox(ownerId);
      return;
    }

    // Get Spotify track duration
    let durationMs = 180000; // Default 3 minutes
    if (winnerSong.spotifyId) {
      try {
        const trackInfo = await spotifyService.getTrack(winnerSong.spotifyId);
        durationMs = trackInfo.duration_ms || durationMs;
      } catch (error) {
        console.warn("Failed to get Spotify track duration:", error.message);
      }
    }

    // Move voting round winner to now playing
    const now = new Date();
    jukebox.nowPlaying = {
      roundId: jukebox.votingRound.roundId,
      roundNumber: jukebox.votingRound.roundNumber,
      song: {
        ...winnerSong,
        title: results.winner.title,
        artist: results.winner.artist,
        spotifyId: results.winner.spotifyId,
        spotifyUri: results.winner.spotifyUri,
      },
      startedAt: now.toISOString(),
      durationMs,
      endsAt: new Date(now.getTime() + durationMs).toISOString(),
    };

    // Move next up to now playing (if it exists)
    if (jukebox.nextUp) {
      // This would be the previous round's winner, but we're already using voting round
      // So we can clear nextUp
      jukebox.nextUp = null;
    }

    // Generate new voting round
    // Pass skipAutoStart=true to prevent recursive jukebox start
    const votingServiceLazy5 = require("./votingService");
    const { round: newVotingRound } = await votingServiceLazy5.generateNextRound(
      jukebox.votingRound.roundId,
      true
    );
    jukebox.votingRound = {
      roundId: newVotingRound.id,
      roundNumber: newVotingRound.currentRoundNumber,
    };

    // Setup timer for next song
    setupJukeboxTimer(jukebox);

    console.log(`✅ Jukebox advanced. Now playing: "${jukebox.nowPlaying.song.title}"`);
    console.log(`🗳️  New voting round: ${jukebox.votingRound.roundId} (Round ${jukebox.votingRound.roundNumber})`);

    // Return jukebox without timer (to avoid circular JSON error)
    const { timer, ...jukeboxResponse } = jukebox;
    return jukeboxResponse;
  } catch (error) {
    console.error("Error advancing jukebox:", error);
    // Try to continue, but log error
    return jukeboxes.get(ownerId);
  }
}

/**
 * Stop jukebox
 */
function stopJukebox(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    return;
  }

  // Clear timer
  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
    jukebox.timer = null;
  }

  jukebox.isActive = false;
  jukeboxes.set(ownerId, jukebox);
  console.log(`🛑 Jukebox stopped for owner ${ownerId}`);
}

/**
 * Get jukebox status
 */
function getJukeboxStatus(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    return null;
  }

  // Calculate time remaining
  let timeRemainingMs = 0;
  let progress = 0;
  if (jukebox.nowPlaying) {
    const now = new Date();
    const endsAt = new Date(jukebox.nowPlaying.endsAt);
    timeRemainingMs = Math.max(0, endsAt.getTime() - now.getTime());
    progress = jukebox.nowPlaying.durationMs > 0
      ? ((jukebox.nowPlaying.durationMs - timeRemainingMs) / jukebox.nowPlaying.durationMs) * 100
      : 0;
  }

  // Return jukebox without timer (to avoid circular JSON error)
  const { timer, ...jukeboxWithoutTimer } = jukebox;
  return {
    ...jukeboxWithoutTimer,
    timeRemainingMs,
    timeRemainingSeconds: Math.round(timeRemainingMs / 1000),
    progress: Math.min(100, Math.max(0, progress)),
  };
}

/**
 * Get voting round for jukebox
 */
function getJukeboxVotingRound(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox || !jukebox.isActive || !jukebox.votingRound) {
    return null;
  }

  return jukebox.votingRound;
}

/**
 * Get countdown info for a round (if it's part of a jukebox)
 * Returns time remaining until current song ends (when voting closes)
 * Works for both voting rounds and now-playing rounds
 */
function getRoundCountdown(roundId) {
  console.log(`[getRoundCountdown] Checking countdown for round ${roundId}`);
  console.log(`[getRoundCountdown] Total jukeboxes in memory: ${jukeboxes.size}`);
  
  // Log all active jukeboxes for debugging
  for (const [ownerId, jukebox] of jukeboxes) {
    console.log(`[getRoundCountdown] Jukebox for owner ${ownerId}:`, {
      isActive: jukebox.isActive,
      votingRoundId: jukebox.votingRound?.roundId,
      nowPlayingRoundId: jukebox.nowPlaying?.roundId,
      nowPlayingSong: jukebox.nowPlaying?.song?.title,
    });
  }
  
  // Check all jukeboxes to see if this round is part of the jukebox
  for (const [ownerId, jukebox] of jukeboxes) {
    if (!jukebox.isActive) {
      console.log(`[getRoundCountdown] Jukebox for owner ${ownerId} is not active`);
      continue;
    }
    
    console.log(`[getRoundCountdown] Checking jukebox for owner ${ownerId}:`, {
      votingRoundId: jukebox.votingRound?.roundId,
      nowPlayingRoundId: jukebox.nowPlaying?.roundId,
      targetRoundId: roundId,
    });
    
    // Check if this is the voting round
    if (jukebox.votingRound && jukebox.votingRound.roundId === roundId) {
      // This round is the active voting round in a jukebox
      if (jukebox.nowPlaying) {
        const now = new Date();
        const endsAt = new Date(jukebox.nowPlaying.endsAt);
        const timeRemainingMs = Math.max(0, endsAt.getTime() - now.getTime());
        const timeRemainingSeconds = Math.round(timeRemainingMs / 1000);
        
        console.log(`[Countdown] Round ${roundId} - Voting round, Time remaining: ${timeRemainingSeconds}s (${Math.round(timeRemainingMs / 1000 / 60)}m)`);
        
        return {
          isJukeboxRound: true,
          isVotingRound: true,
          timeRemainingMs,
          timeRemainingSeconds,
          endsAt: jukebox.nowPlaying.endsAt,
          nowPlaying: jukebox.nowPlaying.song,
          durationMs: jukebox.nowPlaying.durationMs,
        };
      }
    }
    
    // Check if this is the now-playing round
    if (jukebox.nowPlaying && jukebox.nowPlaying.roundId === roundId) {
      // This round is currently playing
      const now = new Date();
      const endsAt = new Date(jukebox.nowPlaying.endsAt);
      const timeRemainingMs = Math.max(0, endsAt.getTime() - now.getTime());
      const timeRemainingSeconds = Math.round(timeRemainingMs / 1000);
      
      console.log(`[Countdown] Round ${roundId} - Now playing round, Time remaining: ${timeRemainingSeconds}s (${Math.round(timeRemainingMs / 1000 / 60)}m)`);
      
      return {
        isJukeboxRound: true,
        isVotingRound: false,
        isNowPlaying: true,
        timeRemainingMs,
        timeRemainingSeconds,
        endsAt: jukebox.nowPlaying.endsAt,
        nowPlaying: jukebox.nowPlaying.song,
        durationMs: jukebox.nowPlaying.durationMs,
        votingRound: jukebox.votingRound, // Include info about the voting round
      };
    }
  }
  
  console.log(`[getRoundCountdown] Round ${roundId} - Not found in any active jukebox`);
  console.log(`[getRoundCountdown] Summary: Checked ${jukeboxes.size} jukebox(es), none matched round ${roundId}`);
  return null; // Round is not part of an active jukebox
}

/**
 * Manually advance jukebox (skip current song)
 */
async function skipCurrentSong(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox || !jukebox.isActive) {
    throw new Error("Jukebox is not active");
  }

  // Clear current timer
  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
  }

  // Advance immediately
  const result = await advanceJukebox(ownerId);
  // advanceJukebox already returns without timer, so we can return it directly
  return result;
}

/**
 * Pause jukebox (pause timer, but keep state)
 */
function pauseJukebox(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    throw new Error("Jukebox not found");
  }

  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
    jukebox.timer = null;
  }

  jukebox.isActive = false;
  jukeboxes.set(ownerId, jukebox);
  console.log(`⏸️  Jukebox paused for owner ${ownerId}`);
}

/**
 * Resume jukebox (resume timer)
 */
function resumeJukebox(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    throw new Error("Jukebox not found");
  }

  if (!jukebox.nowPlaying) {
    throw new Error("No song currently playing");
  }

  // Recalculate end time based on elapsed time
  const now = new Date();
  const startedAt = new Date(jukebox.nowPlaying.startedAt);
  const elapsed = now.getTime() - startedAt.getTime();
  const remaining = jukebox.nowPlaying.durationMs - elapsed;

  if (remaining <= 0) {
    // Song already finished, advance
    advanceJukebox(ownerId);
    return;
  }

  // Update end time
  jukebox.nowPlaying.endsAt = new Date(now.getTime() + remaining).toISOString();

  jukebox.isActive = true;
  setupJukeboxTimer(jukebox);
  jukeboxes.set(ownerId, jukebox);
  console.log(`▶️  Jukebox resumed for owner ${ownerId}`);
}

module.exports = {
  startJukebox,
  startJukeboxWithRandomSong,
  stopJukebox,
  getJukeboxStatus,
  getJukeboxVotingRound,
  getRoundCountdown,
  advanceJukebox,
  skipCurrentSong,
  pauseJukebox,
  resumeJukebox,
};

