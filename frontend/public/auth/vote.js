const BACKEND_URL = (window.BACKEND_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

let currentRoundId = null;
let participantToken = null;
let selectedSongId = null;
let countdownInterval = null;

// Get round ID from URL
function getRoundIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("round");
}

// Get participant token from localStorage
function getParticipantToken() {
  try {
    return localStorage.getItem(`participantToken_${currentRoundId}`) || null;
  } catch (_) {
    return null;
  }
}

// Save participant token
function saveParticipantToken(token) {
  try {
    localStorage.setItem(`participantToken_${currentRoundId}`, token);
  } catch (_) {
    // Ignore if localStorage fails
  }
}

// Load round data
async function loadRound(roundId) {
  try {
    const isNgrok =
      BACKEND_URL.includes("ngrok-free.dev") ||
      BACKEND_URL.includes("ngrok.io");
    const headers = {
      Accept: "application/json",
      ...(isNgrok && { "ngrok-skip-browser-warning": "true" }),
    };

    const response = await fetch(
      `${BACKEND_URL}/api/v1/voting/rounds/${roundId}`,
      {
        method: "GET",
        headers: headers,
        mode: "cors",
        credentials: "omit",
      }
    );

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Get countdown info for round
async function getRoundCountdown(roundId) {
  try {
    const isNgrok =
      BACKEND_URL.includes("ngrok-free.dev") ||
      BACKEND_URL.includes("ngrok.io");
    const headers = {
      Accept: "application/json",
      ...(isNgrok && { "ngrok-skip-browser-warning": "true" }),
    };

    const response = await fetch(
      `${BACKEND_URL}/api/v1/voting/rounds/${roundId}/countdown`,
      {
        method: "GET",
        headers: headers,
        mode: "cors",
        credentials: "omit",
      }
    );

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Format time remaining as MM:SS
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Update countdown display
function updateCountdownDisplay(countdownData) {
  const container = document.getElementById("countdown-container");
  const timerEl = document.getElementById("countdown-timer");

  if (!container || !timerEl) {
    return;
  }

  if (
    countdownData &&
    countdownData.isJukeboxRound &&
    countdownData.timeRemainingSeconds !== null
  ) {
    const seconds = countdownData.timeRemainingSeconds;

    // Show countdown even if time is 0 (will show 00:00)
    timerEl.textContent = formatTimeRemaining(Math.max(0, seconds));
    container.style.display = "block";

    // Add warning class if less than 30 seconds
    if (seconds < 30 && seconds > 0) {
      timerEl.className = "countdown-timer countdown-warning";
    } else {
      timerEl.className = "countdown-timer";
    }
  } else {
    container.style.display = "none";
  }
}

// Start countdown timer
async function startCountdownTimer(roundId) {
  // Clear existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const { ok, data } = await getRoundCountdown(roundId);

  if (ok && data.success) {
    const countdownData = data.data;
    if (
      countdownData &&
      countdownData.isJukeboxRound &&
      countdownData.timeRemainingSeconds !== null
    ) {
      updateCountdownDisplay(countdownData);
    } else {
      updateCountdownDisplay(null);
    }
  } else {
    updateCountdownDisplay(null);
  }

  // Update every second
  countdownInterval = setInterval(async () => {
    const { ok, data } = await getRoundCountdown(roundId);
    if (ok && data.success) {
      const countdownData = data.data;
      if (
        countdownData &&
        countdownData.isJukeboxRound &&
        countdownData.timeRemainingSeconds !== null
      ) {
        updateCountdownDisplay(countdownData);

        // Stop timer if time is up
        if (countdownData.timeRemainingSeconds <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      } else {
        updateCountdownDisplay(null);
      }
    } else {
      updateCountdownDisplay(null);
    }
  }, 1000);
}

// Stop countdown timer
function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Submit vote
async function submitVote(roundId, songId) {
  const token = getParticipantToken();

  try {
    const isNgrok =
      BACKEND_URL.includes("ngrok-free.dev") ||
      BACKEND_URL.includes("ngrok.io");
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(isNgrok && { "ngrok-skip-browser-warning": "true" }),
    };

    const response = await fetch(
      `${BACKEND_URL}/api/v1/voting/rounds/${roundId}/vote`,
      {
        method: "POST",
        headers: headers,
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify({
          songId,
          participantToken: token,
        }),
      }
    );

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Display round and songs
function displayRound(roundData) {
  const { round, songs, results } = roundData;

  // Show voting container
  document.getElementById("loading").style.display = "none";
  document.getElementById("voting-container").style.display = "block";

  // Set round info
  document.getElementById("round-number").textContent =
    round.currentRoundNumber;

  // Show status warning if paused
  const roundInfo = document.getElementById("round-genre");
  let infoText = "";
  if (round.genre) {
    infoText = `Genre: ${round.genre}`;
  }
  if (round.bpm) {
    infoText += infoText ? ` | BPM: ${round.bpm}` : `BPM: ${round.bpm}`;
  }
  if (round.status === "paused") {
    infoText =
      (infoText ? infoText + " | " : "") + "⚠️ Voting is currently paused";
  }
  roundInfo.textContent = infoText;

  // Display songs
  displaySongs(songs, results, round.status);

  // Update vote count
  updateVoteCount(results.totalVotes);
}

// Display songs
function displaySongs(songs, results, roundStatus = "active") {
  const container = document.getElementById("songs-container");

  if (!songs || songs.length === 0) {
    container.innerHTML = "<p>No songs available for this round.</p>";
    return;
  }

  // Get vote counts from results
  const voteCounts = {};
  if (results && results.songs) {
    results.songs.forEach((song) => {
      voteCounts[song.songId] = song.votes;
    });
  }

  const isPaused = roundStatus === "paused";

  container.innerHTML = songs
    .map((song, index) => {
      const votes = voteCounts[song.id] || 0;
      const isSelected = selectedSongId === song.id;

      return `
      <div class="song-card ${isSelected ? "selected" : ""}" data-song-id="${
        song.id
      }">
        <div class="song-number">${index + 1}</div>
        <div class="song-info">
          <h3 class="song-title">${song.title}</h3>
          <p class="song-artist">by ${song.artist}</p>
          ${song.genre ? `<p class="song-meta">Genre: ${song.genre}</p>` : ""}
          ${song.bpm ? `<p class="song-meta">BPM: ${song.bpm}</p>` : ""}
        </div>
        <div class="song-actions">
          <div class="vote-count" id="votes-${song.id}">${votes} votes</div>
          <button class="btn btn-vote" onclick="voteForSong('${song.id}')" ${
        isSelected || isPaused ? "disabled" : ""
      }>
            ${isSelected ? "✓ Voted" : isPaused ? "Voting Paused" : "Vote"}
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

// Vote for a song
window.voteForSong = async function (songId) {
  if (!currentRoundId) {
    showMessage("Error: Round ID not found", false);
    return;
  }

  // Check if voting is paused (this is a client-side check, backend also validates)
  if (document.querySelector(".btn-vote:disabled")) {
    const btn = event?.target;
    if (btn && btn.disabled && btn.textContent.includes("Paused")) {
      showMessage("Voting is currently paused by the round owner", false);
      return;
    }
  }

  // Disable all vote buttons
  document.querySelectorAll(".btn-vote").forEach((btn) => {
    btn.disabled = true;
  });

  const { ok, data } = await submitVote(currentRoundId, songId);

  if (ok && data.success) {
    // Save participant token
    if (data.data && data.data.participantToken) {
      participantToken = data.data.participantToken;
      saveParticipantToken(participantToken);
    }

    selectedSongId = songId;
    showMessage(data.message || "Vote submitted successfully!", true);

    // Update UI with new results
    if (data.data && data.data.results) {
      updateResults(data.data.results);
    }

    // Reload round to get latest data
    setTimeout(() => {
      reloadRound();
    }, 1000);
  } else {
    showMessage("Failed to vote: " + (data.message || "Unknown error"), false);
    // Re-enable buttons
    document.querySelectorAll(".btn-vote").forEach((btn) => {
      btn.disabled = false;
    });
  }
};

// Update vote counts
function updateVoteCount(totalVotes) {
  document.getElementById("votes-count").textContent = totalVotes || 0;
}

// Update results
function updateResults(results) {
  // Update individual vote counts
  if (results.songs) {
    results.songs.forEach((song) => {
      const voteEl = document.getElementById(`votes-${song.songId}`);
      if (voteEl) {
        voteEl.textContent = `${song.votes} votes`;
      }
    });
  }

  // Update total votes
  updateVoteCount(results.totalVotes);

  // Show results section if there are votes
  if (results.totalVotes > 0) {
    displayResults(results);
  }
}

// Display results
function displayResults(results) {
  const section = document.getElementById("results-section");
  const container = document.getElementById("results-container");

  section.style.display = "block";

  container.innerHTML = `
    <div class="results-list">
      ${results.songs
        .slice(0, 3)
        .map(
          (song, index) => `
        <div class="result-item ${index === 0 ? "winner" : ""}">
          <span class="rank">#${index + 1}</span>
          <span class="song-info">"${song.title}" by ${song.artist}</span>
          <span class="votes">${song.votes} votes</span>
        </div>
      `
        )
        .join("")}
    </div>
    ${
      results.winner
        ? `
      <div class="winner-banner">
        <h3>🏆 Current Winner</h3>
        <p>"${results.winner.title}" by ${results.winner.artist}</p>
        ${(() => {
          // Normalize Spotify track ID - extract just the ID from various formats
          function normalizeSpotifyTrackId(spotifyId) {
            if (!spotifyId || typeof spotifyId !== "string") return null;
            const trimmed = spotifyId.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith("spotify:track:"))
              return trimmed.replace("spotify:track:", "");
            const urlMatch = trimmed.match(
              /spotify\.com\/track\/([a-zA-Z0-9]+)/
            );
            if (urlMatch) return urlMatch[1];
            if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
            const idMatch = trimmed.match(/[a-zA-Z0-9]{15,25}/);
            return idMatch ? idMatch[0] : null;
          }
          const normalizedId = normalizeSpotifyTrackId(
            results.winner.spotifyId
          );
          if (!normalizedId && results.winner.spotifyId) {
            console.warn(
              "Failed to normalize Spotify ID:",
              results.winner.spotifyId,
              "for song:",
              results.winner.title
            );
          }
          return normalizedId
            ? `
          <div style="margin: 16px 0;">
            <iframe 
              src="https://open.spotify.com/embed/track/${normalizedId}?utm_source=generator" 
              width="100%" 
              height="352" 
              frameBorder="0" 
              allowtransparency="true" 
              allow="encrypted-media"
              style="border-radius: 8px; max-width: 100%;"
              loading="lazy">
            </iframe>
            <p style="color: #666; font-size: 0.85em; margin-top: 8px; text-align: center;">
              ⚠️ Preview only. <a href="https://open.spotify.com/track/${normalizedId}" target="_blank" style="color: #1DB954; text-decoration: underline;">Open in Spotify</a> for full playback
            </p>
          </div>
        `
            : "";
        })()}
      </div>
    `
        : ""
    }
  `;
}

// Show message
function showMessage(text, isSuccess) {
  const msgEl = document.getElementById("vote-message");
  if (msgEl) {
    msgEl.textContent = text;
    msgEl.className = `msg ${isSuccess ? "ok" : "err"}`;
    msgEl.style.display = "block";
    setTimeout(() => {
      msgEl.style.display = "none";
    }, 3000);
  }
}

// Show error
function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error").style.display = "block";
  document.getElementById("error-message").textContent = message;
}

// Reload round data
async function reloadRound() {
  if (!currentRoundId) return;

  const { ok, data } = await loadRound(currentRoundId);
  if (ok && data.success) {
    displayRound(data.data);
  }
}

// Initialize
// Initialize vote page
async function initVote() {
  // Get round ID from URL
  currentRoundId = getRoundIdFromURL();

  if (!currentRoundId) {
    showError(
      "No round ID provided in URL. Please scan the QR code or use a valid voting link."
    );
    return;
  }

  // Get participant token
  participantToken = getParticipantToken();

  // Load round
  const { ok, data, error } = await loadRound(currentRoundId);

  if (!ok) {
    if (error) {
      showError(`Network error: ${error}`);
    } else if (data && data.message) {
      showError(data.message);
    } else {
      showError(
        "Failed to load voting round. Please check the URL and try again."
      );
    }
    return;
  }

  if (data.success && data.data) {
    displayRound(data.data);

    // Start countdown timer
    startCountdownTimer(currentRoundId);

    // Auto-refresh results every 5 seconds
    setInterval(() => {
      reloadRound();
    }, 5000);
  } else {
    showError("Invalid round data received from server.");
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    stopCountdownTimer();
  });
}

// Fallback: Initialize if DOM is already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVote);
} else if (!window.__voteInitialized) {
  setTimeout(() => {
    if (!window.__voteInitialized) {
      initVote();
    }
  }, 100);
}
