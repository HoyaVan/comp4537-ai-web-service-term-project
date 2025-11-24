// Use lazy requires to avoid circular dependency issues
const spotifyService = require("./spotifyService");
const authService = require("./authService");
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
      initialCriteria: {
        genre: round.genre,
        artists: round.artists,
        mood: round.mood,
        energy: round.energy,
        bpm: round.bpm,
      },
    };

    // Add initial winning song to user's Spotify playlist and queue (async, don't wait)
    if (results.winner.spotifyUri) {
      const winnerSong = {
        spotifyUri: results.winner.spotifyUri,
        title: results.winner.title,
        artist: results.winner.artist,
      };
      
      // Add to playlist
      addWinnerToPlaylist(ownerId, winnerSong, jukebox.initialCriteria).catch(error => {
        console.warn("Failed to add initial winner to playlist (non-blocking):", error.message);
      });
      
      // Add to queue (for Premium users with active device)
      addWinnerToQueue(ownerId, winnerSong).catch(error => {
        // Silently fail - queue requires Premium and active device
      });
    }

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
 * Generate playlist name from round criteria
 * @param {Object} roundCriteria - Round criteria (genre, artists, mood, energy, bpm)
 * @returns {string} Formatted playlist name
 */
function generatePlaylistName(roundCriteria) {
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });

  const parts = [];
  
  // Add genre if available
  if (roundCriteria?.genre) {
    parts.push(roundCriteria.genre);
  }
  
  // Add artists if available (limit to first 2)
  if (roundCriteria?.artists && roundCriteria.artists.length > 0) {
    const artistStr = roundCriteria.artists.slice(0, 2).join(", ");
    parts.push(artistStr);
  }
  
  // Add mood if available
  if (roundCriteria?.mood && roundCriteria.mood !== "Any") {
    parts.push(roundCriteria.mood);
  }
  
  // Add energy if available
  if (roundCriteria?.energy && roundCriteria.energy !== "Any") {
    parts.push(roundCriteria.energy);
  }
  
  // Add BPM if available
  if (roundCriteria?.bpm) {
    parts.push(`${roundCriteria.bpm} BPM`);
  }

  // Build name: "DJ Clownfish - {Date} - {Criteria}"
  let name = `DJ Clownfish - ${dateStr}`;
  if (parts.length > 0) {
    name += ` - ${parts.join(" • ")}`;
  }

  // Spotify playlist name limit is 100 characters
  if (name.length > 100) {
    // Truncate criteria but keep date
    const maxCriteriaLength = 100 - name.length + parts.join(" • ").length;
    if (maxCriteriaLength > 0) {
      const truncatedCriteria = parts.join(" • ").substring(0, maxCriteriaLength - 3) + "...";
      name = `DJ Clownfish - ${dateStr} - ${truncatedCriteria}`;
    } else {
      // If even date is too long (shouldn't happen), just use date
      name = `DJ Clownfish - ${dateStr}`;
    }
  }

  return name;
}

/**
 * Get or create Spotify playlist for user's jukebox session
 * @param {string} ownerId - User ID
 * @param {Object} roundCriteria - Round criteria (genre, artists, mood, energy, bpm) for playlist naming
 * @returns {Promise<Object|null>} Playlist object with id and external_urls, or null if user not connected
 */
async function getOrCreateJukeboxPlaylist(ownerId, roundCriteria = null) {
  try {
    // Get user's Spotify tokens
    const tokens = await authService.getUserSpotifyTokens(ownerId);
    if (!tokens || !tokens.accessToken) {
      return null; // User not connected to Spotify
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.accessToken;
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await spotifyService.refreshAccessToken(tokens.refreshToken);
          accessToken = refreshed.access_token;
          
          // Update tokens in database
          // Use new refresh token if Spotify provided one, otherwise keep existing
          const newRefreshToken = refreshed.refresh_token || tokens.refreshToken;
          const newExpiresAt = Date.now() + (refreshed.expires_in * 1000);
          await authService.updateUserSpotifyTokens(
            ownerId,
            refreshed.access_token,
            newRefreshToken,
            newExpiresAt
          );
        } catch (error) {
          console.error("Failed to refresh Spotify token:", error.message);
          return null;
        }
      } else {
        return null; // No refresh token available
      }
    }

    // Get user's Spotify profile
    const userProfile = await spotifyService.getUserProfile(accessToken);
    
    // Generate playlist name with date and round criteria
    const playlistName = generatePlaylistName(roundCriteria);
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });

    // Build description with criteria
    let description = `Auto-generated playlist from DJ Clownfish jukebox session on ${dateStr}.`;
    if (roundCriteria) {
      const criteriaParts = [];
      if (roundCriteria.genre) criteriaParts.push(`Genre: ${roundCriteria.genre}`);
      if (roundCriteria.artists && roundCriteria.artists.length > 0) {
        criteriaParts.push(`Artists: ${roundCriteria.artists.join(", ")}`);
      }
      if (roundCriteria.mood && roundCriteria.mood !== "Any") {
        criteriaParts.push(`Mood: ${roundCriteria.mood}`);
      }
      if (roundCriteria.energy && roundCriteria.energy !== "Any") {
        criteriaParts.push(`Energy: ${roundCriteria.energy}`);
      }
      if (roundCriteria.bpm) criteriaParts.push(`BPM: ${roundCriteria.bpm}`);
      
      if (criteriaParts.length > 0) {
        description += ` Criteria: ${criteriaParts.join(" • ")}.`;
      }
    }
    description += " Songs are added automatically as they win voting rounds.";

    // Check if playlist already exists
    let playlist = await spotifyService.getUserPlaylistByName(accessToken, playlistName);
    
    if (!playlist) {
      // Create new playlist
      playlist = await spotifyService.createPlaylist(
        accessToken,
        userProfile.id,
        playlistName,
        description,
        true // public
      );
    }

    return playlist;
  } catch (error) {
    console.error("Error getting/creating Spotify playlist:", error.message);
    return null; // Fail silently - don't break jukebox if playlist fails
  }
}

/**
 * Add winning song to user's Spotify queue (for Premium users with active device)
 * @param {string} ownerId - User ID
 * @param {Object} winnerSong - Song object with spotifyUri
 * @returns {Promise<boolean>} True if added successfully, false otherwise
 */
async function addWinnerToQueue(ownerId, winnerSong) {
  try {
    if (!winnerSong.spotifyUri) {
      return false; // No Spotify URI, can't add to queue
    }

    // Get user's Spotify tokens
    const tokens = await authService.getUserSpotifyTokens(ownerId);
    if (!tokens || !tokens.accessToken) {
      return false; // User not connected to Spotify
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.accessToken;
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await spotifyService.refreshAccessToken(tokens.refreshToken);
          accessToken = refreshed.access_token;
          // Use new refresh token if Spotify provided one, otherwise keep existing
          const newRefreshToken = refreshed.refresh_token || tokens.refreshToken;
          const newExpiresAt = Date.now() + (refreshed.expires_in * 1000);
          await authService.updateUserSpotifyTokens(
            ownerId,
            refreshed.access_token,
            newRefreshToken,
            newExpiresAt
          );
        } catch (error) {
          console.error("Failed to refresh token for queue:", error.message);
          return false;
        }
      } else {
        return false;
      }
    }

    // Add track to queue (non-blocking, fails silently if Premium not available or no active device)
    try {
      await spotifyService.addToQueue(accessToken, winnerSong.spotifyUri);
      return true;
    } catch (error) {
      // Expected errors: Premium required, no active device, etc.
      // Log but don't throw - this is optional functionality
      console.log(`Could not add to queue (non-critical): ${error.message}`);
      return false;
    }
  } catch (error) {
    console.error("Error adding winner to Spotify queue:", error.message);
    return false; // Fail silently - don't break jukebox
  }
}

/**
 * Add winning song to user's Spotify playlist
 * @param {string} ownerId - User ID
 * @param {Object} winnerSong - Song object with spotifyUri
 * @param {Object} roundCriteria - Round criteria for playlist naming (optional, will get from jukebox if not provided)
 * @returns {Promise<boolean>} True if added successfully, false otherwise
 */
async function addWinnerToPlaylist(ownerId, winnerSong, roundCriteria = null) {
  try {
    if (!winnerSong.spotifyUri) {
      return false; // No Spotify URI, can't add to playlist
    }

    // If roundCriteria not provided, try to get from jukebox
    if (!roundCriteria) {
      const jukebox = jukeboxes.get(ownerId);
      if (jukebox) {
        // Try to get from initialCriteria (for startJukeboxWithRandomSong)
        if (jukebox.initialCriteria) {
          roundCriteria = jukebox.initialCriteria;
        } else if (jukebox.votingRound) {
          // Try to get from voting round
          const votingServiceLazy = require("./votingService");
          const round = votingServiceLazy.getRoundById(jukebox.votingRound.roundId);
          if (round) {
            roundCriteria = {
              genre: round.genre,
              artists: round.artists,
              mood: round.mood,
              energy: round.energy,
              bpm: round.bpm,
            };
          }
        }
      }
    }

    const playlist = await getOrCreateJukeboxPlaylist(ownerId, roundCriteria);
    if (!playlist) {
      return false; // User not connected or playlist creation failed
    }

    // Get user's access token (with refresh if needed)
    const tokens = await authService.getUserSpotifyTokens(ownerId);
    if (!tokens || !tokens.accessToken) {
      return false;
    }

    let accessToken = tokens.accessToken;
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await spotifyService.refreshAccessToken(tokens.refreshToken);
          accessToken = refreshed.access_token;
          // Use new refresh token if Spotify provided one, otherwise keep existing
          const newRefreshToken = refreshed.refresh_token || tokens.refreshToken;
          const newExpiresAt = Date.now() + (refreshed.expires_in * 1000);
          await authService.updateUserSpotifyTokens(
            ownerId,
            refreshed.access_token,
            newRefreshToken,
            newExpiresAt
          );
        } catch (error) {
          console.error("Failed to refresh token for playlist:", error.message);
          return false;
        }
      } else {
        return false;
      }
    }

    // Add track to playlist
    await spotifyService.addTracksToPlaylist(accessToken, playlist.id, [winnerSong.spotifyUri]);
    
    return true;
  } catch (error) {
    console.error("Error adding winner to Spotify playlist:", error.message);
    return false; // Fail silently - don't break jukebox
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

    // Add winning song to user's Spotify playlist and queue (async, don't wait)
    if (results.winner.spotifyUri) {
      // Get round criteria from jukebox or voting round
      let roundCriteria = jukebox.initialCriteria;
      if (!roundCriteria && jukebox.votingRound) {
        const votingServiceLazy6 = require("./votingService");
        const currentRound = votingServiceLazy6.getRoundById(jukebox.votingRound.roundId);
        if (currentRound) {
          roundCriteria = {
            genre: currentRound.genre,
            artists: currentRound.artists,
            mood: currentRound.mood,
            energy: currentRound.energy,
            bpm: currentRound.bpm,
          };
        }
      }
      
      const winnerSong = {
        spotifyUri: results.winner.spotifyUri,
        title: results.winner.title,
        artist: results.winner.artist,
      };
      
      // Add to playlist
      addWinnerToPlaylist(jukebox.ownerId, winnerSong, roundCriteria).catch(error => {
        console.warn("Failed to add winner to playlist (non-blocking):", error.message);
      });
      
      // Add to queue (for Premium users with active device)
      addWinnerToQueue(jukebox.ownerId, winnerSong).catch(error => {
        // Silently fail - queue requires Premium and active device
      });
    }

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
