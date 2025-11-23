// Use lazy requires to avoid circular dependency issues
const spotifyService = require("./spotifyService");
const crypto = require("crypto");
const aiService = require("./aiService");

// Jukebox state for each owner
const jukeboxes = new Map();

/**
 * Jukebox state structure:
 * {
 *   ownerId: string,
 *   isActive: boolean,
 *   nowPlaying: { roundId, roundNumber, song, startedAt, durationMs, endsAt },
 *   nextUp: { roundId, roundNumber, song },
 *   votingRound: { roundId, roundNumber },
 *   timer: NodeJS.Timeout | null
 * }
 */

/**
 * Generate fallback songs if AI fails
 */
function generateFallbackSongs(round) {
  const defaultSongs = [];
  for (let i = 1; i <= 10; i++) {
    defaultSongs.push({
      title: `Song ${i}`,
      artist: `Artist ${i}`,
      spotifyId: null,
      spotifyUri: null,
      genre: round.genre || "Pop",
      bpm: round.bpm || 120,
    });
  }
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

    let aiResponseText = "";
    if (response.choices && response.choices[0]) {
      aiResponseText = response.choices[0].message?.content || "";
    } else if (response.content) {
      aiResponseText = response.content;
    } else {
      console.error("AI response structure unexpected:", JSON.stringify(response, null, 2));
    }

    if (!aiResponseText || aiResponseText.trim().length === 0) {
      console.error("AI returned empty response");
      return generateFallbackSongs(round);
    }

    let songList = [];
    try {
      aiResponseText = aiResponseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = aiResponseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        songList = JSON.parse(jsonMatch[0]);
      } else {
        songList = JSON.parse(aiResponseText);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError.message);
      songList = generateFallbackSongs(round);
    }

    if (!Array.isArray(songList) || songList.length === 0) {
      console.error("Song list is not an array or is empty");
      songList = generateFallbackSongs(round);
    }

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
    console.error("Error generating songs with AI:", error.message);
    return generateFallbackSongs(round);
  }
}

/**
 * Start jukebox mode with a random song
 */
async function startJukeboxWithRandomSong(ownerId, roundData) {
  try {
    // Search Spotify for a random song based on criteria
    let searchQuery = "";
    if (roundData.genre) {
      searchQuery += `${roundData.genre} `;
    }
    if (roundData.artists && roundData.artists.length > 0) {
      searchQuery += `artist:${roundData.artists[0]} `;
    }
    if (roundData.mood) {
      searchQuery += roundData.mood + " ";
    }
    if (!searchQuery.trim()) {
      searchQuery = "popular";
    }

    let randomTrack = null;
    try {
      const tracks = await spotifyService.searchTracks(searchQuery.trim(), 50);
      if (tracks && tracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * tracks.length);
        randomTrack = tracks[randomIndex];
      }
    } catch (error) {
      console.error("Failed to get random song from Spotify:", error.message);
    }

    if (!randomTrack) {
      randomTrack = {
        id: null,
        uri: null,
        name: "Welcome Song",
        artist: "Various Artists",
        duration_ms: 180000,
      };
    }

    const now = new Date();
    const durationMs = randomTrack.duration_ms || 180000;
    const startedAt = now.toISOString();
    const endsAt = new Date(now.getTime() + durationMs).toISOString();

    const jukebox = {
      ownerId,
      isActive: true,
      nowPlaying: {
        roundId: null,
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
      initialCriteria: roundData,
    };

    // Generate first voting round
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
    
    const initialSongs = await generateSongsWithAI(round, null, null);
    
    // Add round to storage using lazy require to avoid circular dependency
    const votingServiceLazy = require("./votingService");
    await new Promise((resolve) => setImmediate(resolve));
    
    if (typeof votingServiceLazy._internalAddRound !== 'function') {
      console.error("_internalAddRound is not available - circular dependency issue");
      throw new Error("_internalAddRound is not available");
    }
    
    votingServiceLazy._internalAddRound(round);
    
    const verifyAfterAdd = votingServiceLazy.getRoundById(round.id);
    if (!verifyAfterAdd) {
      console.error(`Round ${round.id} not found after adding`);
      throw new Error(`Failed to add round ${round.id} to votingRounds`);
    }
    
    initialSongs.forEach((song, index) => {
      if (typeof votingServiceLazy._internalAddSong !== 'function') {
        throw new Error("_internalAddSong is not available");
      }
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
    });
    
    const votingRound = round;
    const votingServiceLazy1 = require("./votingService");
    const verifyRound = votingServiceLazy1.getRoundById(votingRound.id);
    if (!verifyRound) {
      console.error(`Voting round ${votingRound.id} not found after creation`);
      throw new Error(`Voting round ${votingRound.id} not found after creation`);
    }
    
    jukebox.votingRound = {
      roundId: votingRound.id,
      roundNumber: votingRound.currentRoundNumber,
    };

    setupJukeboxTimer(jukebox);
    jukeboxes.set(ownerId, jukebox);
    
    const { timer, ...jukeboxResponse } = jukebox;
    return jukeboxResponse;
  } catch (error) {
    console.error("Error starting jukebox with random song:", error);
    throw error;
  }
}

/**
 * Start jukebox mode for an owner (for existing rounds with winners)
 */
async function startJukebox(ownerId, initialRoundId) {
  try {
    const votingServiceLazy2 = require("./votingService");
    let round = votingServiceLazy2.getRoundById(initialRoundId);
    if (!round) {
      throw new Error("Initial round not found");
    }

    const results = votingServiceLazy2.getVotingResults(initialRoundId, round.currentRoundNumber);
    if (!results.winner) {
      throw new Error("No winner found for initial round. Ensure voting has completed.");
    }

    const winnerSong = votingServiceLazy2.getSongsByRound(initialRoundId, round.currentRoundNumber)
      .find(s => s.id === results.winner.songId);

    if (!winnerSong) {
      throw new Error("Winner song not found");
    }

    let durationMs = 180000;
    if (winnerSong.spotifyId) {
      try {
        const trackInfo = await spotifyService.getTrack(winnerSong.spotifyId);
        durationMs = trackInfo.duration_ms || durationMs;
      } catch (error) {
        console.warn("Failed to get Spotify track duration:", error.message);
      }
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const endsAt = new Date(now.getTime() + durationMs).toISOString();

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

    const votingServiceLazy3 = require("./votingService");
    const { round: votingRound } = await votingServiceLazy3.generateNextRound(initialRoundId, true);
    jukebox.votingRound = {
      roundId: votingRound.id,
      roundNumber: votingRound.currentRoundNumber,
    };

    setupJukeboxTimer(jukebox);
    jukeboxes.set(ownerId, jukebox);
    
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
    advanceJukebox(jukebox.ownerId);
    return;
  }

  jukebox.timer = setTimeout(() => {
    advanceJukebox(jukebox.ownerId);
  }, timeUntilEnd);
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

    if (!jukebox.votingRound || !jukebox.votingRound.roundId) {
      setTimeout(() => advanceJukebox(ownerId), 5000);
      return;
    }

    const votingServiceLazy4 = require("./votingService");
    const votingRound = votingServiceLazy4.getRoundById(jukebox.votingRound.roundId);
    if (!votingRound) {
      console.error("Voting round not found, stopping jukebox");
      stopJukebox(ownerId);
      return;
    }

    const results = votingServiceLazy4.getVotingResults(
      jukebox.votingRound.roundId,
      jukebox.votingRound.roundNumber
    );

    if (!results.winner || results.totalVotes === 0) {
      const songs = votingServiceLazy4.getSongsByRound(
        jukebox.votingRound.roundId,
        jukebox.votingRound.roundNumber
      );
      if (songs.length === 0) {
        console.error("No songs in voting round, stopping jukebox");
        stopJukebox(ownerId);
        return;
      }
      const topSong = songs.sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
      results.winner = {
        songId: topSong.id,
        title: topSong.title,
        artist: topSong.artist,
        spotifyId: topSong.spotifyId,
        spotifyUri: topSong.spotifyUri,
      };
    }

    const winnerSong = votingServiceLazy4.getSongsByRound(
      jukebox.votingRound.roundId,
      jukebox.votingRound.roundNumber
    ).find(s => s.id === results.winner.songId);

    if (!winnerSong) {
      console.error("Winner song not found, stopping jukebox");
      stopJukebox(ownerId);
      return;
    }

    let durationMs = 180000;
    if (winnerSong.spotifyId) {
      try {
        const trackInfo = await spotifyService.getTrack(winnerSong.spotifyId);
        durationMs = trackInfo.duration_ms || durationMs;
      } catch (error) {
        console.warn("Failed to get Spotify track duration:", error.message);
      }
    }

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

    if (jukebox.nextUp) {
      jukebox.nextUp = null;
    }

    const votingServiceLazy5 = require("./votingService");
    const { round: newVotingRound } = await votingServiceLazy5.generateNextRound(
      jukebox.votingRound.roundId,
      true
    );
    jukebox.votingRound = {
      roundId: newVotingRound.id,
      roundNumber: newVotingRound.currentRoundNumber,
    };

    setupJukeboxTimer(jukebox);

    const { timer, ...jukeboxResponse } = jukebox;
    return jukeboxResponse;
  } catch (error) {
    console.error("Error advancing jukebox:", error);
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

  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
    jukebox.timer = null;
  }

  jukebox.isActive = false;
  jukeboxes.set(ownerId, jukebox);
}

/**
 * Get jukebox status
 */
function getJukeboxStatus(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    return null;
  }

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
 */
function getRoundCountdown(roundId) {
  for (const [ownerId, jukebox] of jukeboxes) {
    if (!jukebox.isActive) {
      continue;
    }
    
    if (jukebox.votingRound && jukebox.votingRound.roundId === roundId) {
      if (jukebox.nowPlaying) {
        const now = new Date();
        const endsAt = new Date(jukebox.nowPlaying.endsAt);
        const timeRemainingMs = Math.max(0, endsAt.getTime() - now.getTime());
        const timeRemainingSeconds = Math.round(timeRemainingMs / 1000);
        
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
    
    if (jukebox.nowPlaying && jukebox.nowPlaying.roundId === roundId) {
      const now = new Date();
      const endsAt = new Date(jukebox.nowPlaying.endsAt);
      const timeRemainingMs = Math.max(0, endsAt.getTime() - now.getTime());
      const timeRemainingSeconds = Math.round(timeRemainingMs / 1000);
      
      return {
        isJukeboxRound: true,
        isVotingRound: false,
        isNowPlaying: true,
        timeRemainingMs,
        timeRemainingSeconds,
        endsAt: jukebox.nowPlaying.endsAt,
        nowPlaying: jukebox.nowPlaying.song,
        durationMs: jukebox.nowPlaying.durationMs,
        votingRound: jukebox.votingRound,
      };
    }
  }
  
  return null;
}

/**
 * Manually advance jukebox (skip current song)
 */
async function skipCurrentSong(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox || !jukebox.isActive) {
    throw new Error("Jukebox is not active");
  }

  if (jukebox.timer) {
    clearTimeout(jukebox.timer);
  }

  return await advanceJukebox(ownerId);
}

/**
 * Pause jukebox
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
}

/**
 * Resume jukebox
 */
function resumeJukebox(ownerId) {
  const jukebox = jukeboxes.get(ownerId);
  if (!jukebox) {
    throw new Error("Jukebox not found");
  }

  if (!jukebox.nowPlaying) {
    throw new Error("No song currently playing");
  }

  const now = new Date();
  const startedAt = new Date(jukebox.nowPlaying.startedAt);
  const elapsed = now.getTime() - startedAt.getTime();
  const remaining = jukebox.nowPlaying.durationMs - elapsed;

  if (remaining <= 0) {
    advanceJukebox(ownerId);
    return;
  }

  jukebox.nowPlaying.endsAt = new Date(now.getTime() + remaining).toISOString();
  jukebox.isActive = true;
  setupJukeboxTimer(jukebox);
  jukeboxes.set(ownerId, jukebox);
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
