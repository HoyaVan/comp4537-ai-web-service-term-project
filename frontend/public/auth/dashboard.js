import { dashboardMessages } from '/messages/dashboard.js';

const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Check if user is authenticated
function isAuthenticated() {
  try {
    const token = localStorage.getItem("token");

    return !!token;
  } catch (_) {
    return false;
  }
}

// Get token from localStorage
function getToken() {
  try {
    return localStorage.getItem("token");
  } catch (_) {
    return null;
  }
}

// Display API limit warning
function showApiLimitWarning(message) {
  // Check if warning already exists to avoid duplicates
  let warningEl = document.getElementById('api-limit-warning');
  if (!warningEl) {
    warningEl = document.createElement('div');
    warningEl.id = 'api-limit-warning';
    warningEl.className = 'api-limit-warning';
    document.body.appendChild(warningEl);
  }
  warningEl.textContent = message;
  warningEl.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (warningEl) {
      warningEl.classList.add('hidden');
    }
  }, 5000);
}

// Make authenticated API request
async function apiRequest(url, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(BACKEND_URL + url, {
    ...options,
    headers,
    mode: "cors",
    credentials: "include",
  });

  // Check for API limit warning headers
  const limitExceeded = response.headers.get('X-API-Limit-Exceeded');
  const limitMessage = response.headers.get('X-API-Limit-Message');
  
  if (limitExceeded === 'true' && limitMessage) {
    // Display warning but continue with the request
    showApiLimitWarning(limitMessage);
  }

  const data = await response.json();

  return { ok: response.ok, status: response.status, data };
}

// Load user info and return user object
async function loadUserInfo() {
  const { ok, data } = await apiRequest("/api/v1/v1/auth/profile");
  if (ok && data.success) {
    const user = data.data;
    const userEmail = document.getElementById("user-email");
    if (userEmail) userEmail.textContent = user.email || dashboardMessages.user;

    // Display API consumption
    displayApiConsumption(user.apiConsumption);
    
    return user; // Return user object for role checking
  }
  return null;
}

async function loadSpotifyToken() {
  const auth = await apiRequest("/api/v1/spotify/auth");
  console.log("auth: ", auth);
  const callback = await apiRequest("/api/v1/spotify/callback" + "?code=" + encodeURIComponent(auth.data.code));
  console.log("callback: ", callback);

  
  const { ok, data } = await apiRequest("/api/v1/spotify/token");
  console.log("data: ", data);
  if (ok && data.success) {
    localStorage.setItem("spotify_token", data.data.access_token);
    localStorage.setItem("spotify_refresh_token", data.data.refresh_token);
    localStorage.setItem("spotify_expires_in", data.data.expires_in);
    localStorage.setItem("spotify_token_type", data.data.token_type);
    localStorage.setItem("spotify_scope", data.data.scope);
    localStorage.setItem("spotify_state", data.data.state);
    return data.data;
  }
  return null;
}

// Display API consumption
function displayApiConsumption(consumption) {
  const container = document.getElementById("api-consumption");
  if (!container || !consumption) return;

  const callsUsed = consumption.callsUsed || 0;
  const isUnlimited =
    consumption.hasUnlimitedCalls || consumption.callsLimit === "unlimited";

  container.innerHTML = `
    <div class="api-stats">
      <div class="api-stat-item">
        <span class="api-stat-label">API Calls Used:</span>
        <span class="api-stat-value">${callsUsed.toLocaleString()}</span>
      </div>
      <div class="api-stat-item">
        <span class="api-stat-label">Limit:</span>
        <span class="api-stat-value api-stat-unlimited">${
          isUnlimited ? "Unlimited" : consumption.callsLimit || "N/A"
        }</span>
      </div>
      ${
        !isUnlimited && consumption.callsRemaining !== undefined
          ? `
        <div class="api-stat-item">
          <span class="api-stat-label">Remaining:</span>
          <span class="api-stat-value">${consumption.callsRemaining}</span>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Create new voting round
async function createRound(roundData) {
  // Parse artists string into array
  const artists = roundData.artists
    ? roundData.artists
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a)
    : [];

  const payload = {
    genre: roundData.genre || null,
    bpm: roundData.bpm ? parseInt(roundData.bpm) : null,
    artists: artists.length > 0 ? artists : [],
    mood: roundData.mood || null,
    energy: roundData.energy || null,
  };

  const { ok, data } = await apiRequest("/api/v1/voting/rounds", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { ok, data };
}

// Load all rounds
async function loadRounds() {
  const { ok, data } = await apiRequest("/api/v1/voting/rounds");
  if (ok && data.success) {
    return data.data || [];
  }
  return [];
}

// Get QR code data
async function getQRCode(roundId) {
  const { ok, data } = await apiRequest(`/api/v1/voting/rounds/${roundId}/qr`);
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Generate QR code image
function generateQRCode(url, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<p>${dashboardMessages.generatingQrCode}</p>`;
  
  // Function to try generating QR code
  const tryGenerateQR = () => {
    // Check if QRCode library is available (try multiple possible names)
    const QRCodeLib = window.QRCode || window.qrcode;

    if (QRCodeLib && typeof QRCodeLib.toDataURL === "function") {
      try {
        QRCodeLib.toDataURL(
          url,
          { width: 256, margin: 2 },
          (error, dataUrl) => {
            if (error) {
              console.error("QR Code generation error:", error);
              // Fallback to online QR code generator
              useFallbackQR();
            } else {
              container.innerHTML = `<img src="${dataUrl}" alt="QR Code" style="max-width: 100%; height: auto;" />`;
            }
          }
        );
      } catch (error) {
        console.error("QR Code error:", error);
        useFallbackQR();
      }
    } else {
      // Library not loaded yet, wait a bit and try again
      setTimeout(() => {
        if (window.QRCodeLoaded || window.QRCode || window.qrcode) {
          tryGenerateQR();
        } else {
          // After 2 seconds, give up and use fallback
          useFallbackQR();
        }
      }, 200);
    }
  };

  // Fallback function using online QR code API
  const useFallbackQR = () => {
    container.innerHTML = `
      <div style="text-align: center;">
        <p>Voting URL:</p>
        <p style="word-break: break-all; margin: 10px 0;"><a href="${url}" target="_blank" style="color: #007bff;">${url}</a></p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
          url
        )}" alt="QR Code" style="max-width: 100%; height: auto; border: 1px solid #ddd; padding: 10px; background: white;" />
        <p style="margin-top: 10px; font-size: 0.9em; color: #666;">Scan this QR code with your phone to access the voting page</p>
      </div>
    `;
  };

  // Start trying to generate QR code
  tryGenerateQR();
}

// Generate next round
async function generateNextRound(roundId) {
  const { ok, data } = await apiRequest(
    `/api/v1/voting/rounds/${roundId}/next-round`,
    {
      method: "POST",
    }
  );
  return { ok, data };
}

// Update round status
async function updateRoundStatus(roundId, status) {
  const { ok, data } = await apiRequest(
    `/api/v1/voting/rounds/${roundId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
  return { ok, data };
}

// Get results
async function getResults(roundId) {
  const { ok, data } = await apiRequest(
    `/api/v1/voting/rounds/${roundId}/results`
  );
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Initiate Spotify OAuth
async function initiateSpotifyOAuth() {
  const { ok, data } = await apiRequest("/api/v1/spotify/auth");
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Handle Spotify OAuth callback
async function handleSpotifyOAuthCallback() {
  const { ok, data } = await apiRequest("/api/v1/spotify/callback");
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// get spotify track info
async function getSpotifyTrackInfo(trackId) {
  // Don't make API call if trackId is null or empty
  if (!trackId || trackId === "null" || trackId === "undefined") {
    return null;
  }

  const { ok, data } = await apiRequest(`/api/v1/spotify/tracks/${trackId}`);
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Get countdown info for round
async function getRoundCountdown(roundId) {
  try {
    const { ok, data } = await apiRequest(
      `/api/v1/voting/rounds/${roundId}/countdown`
    );
    if (ok && data.success) {
      return data.data;
    }
  } catch (error) {
    console.error("Error fetching countdown:", error);
  }
  return null;
}

// Format time remaining as MM:SS
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Display rounds
function displayRounds(rounds) {
  const container = document.getElementById("rounds-container");
  if (!container) return;

  if (rounds.length === 0) {
    container.innerHTML = `<p class="no-rounds">${dashboardMessages.noRoundsYet}</p>`;
    return;
  }

  container.innerHTML = rounds
    .map(
      (round) => `
    <div class="round-card ${
      round._isJukeboxVotingRound ? "jukebox-round" : ""
    }">
      <div class="round-header">
        <h3>Round ${round.currentRoundNumber}</h3>
        <span class="round-status ${round.status}">${round.status}</span>
        ${
          round._isJukeboxVotingRound
            ? '<span class="jukebox-badge" title="Active jukebox voting round - countdown timer available">🎵 Jukebox</span>'
            : ""
        }
      </div>
      <div class="round-info">
        ${round.genre ? `<p><strong>Genre:</strong> ${round.genre}</p>` : ""}
        ${round.bpm ? `<p><strong>BPM:</strong> ${round.bpm}</p>` : ""}
        ${
          round.artists && round.artists.length > 0
            ? `<p><strong>Artists:</strong> ${round.artists.join(", ")}</p>`
            : ""
        }
        <p><strong>Total Votes:</strong> ${round.totalVotes || 0}</p>
        <p><strong>Songs:</strong> ${round.songCount || 0}</p>
      </div>
      ${
        round.winner
          ? `<p class="winner"><strong>Winner:</strong> "${round.winner.title}" by ${round.winner.artist}</p>`
          : ""
      }
      <div class="round-actions">
        <button class="btn btn-small" onclick="showQRCode('${
          round.id
        }')">Show QR Code</button>
        <button class="btn btn-small" onclick="viewResults('${
          round.id
        }')">View Results</button>
        ${
          round.status === "active"
            ? `
          <button class="btn btn-small btn-warning" onclick="pauseRound('${round.id}')">Pause</button>
        `
            : round.status === "paused"
            ? `
          <button class="btn btn-small btn-success" onclick="resumeRound('${round.id}')">Resume</button>
        `
            : ""
        }
        <button class="btn btn-small" onclick="generateNext('${
          round.id
        }')">Generate Next Round</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Show QR code modal
window.showQRCode = async function (roundId) {
  const qrData = await getQRCode(roundId);
  if (!qrData) {
    alert(dashboardMessages.failedToGetQrCode);
    return;
  }

  const modal = document.getElementById("qr-modal");
  const urlEl = document.getElementById("qr-url");
  const container = document.getElementById("qr-code-container");

  if (urlEl) urlEl.textContent = qrData.votingUrl;
  generateQRCode(qrData.votingUrl, "qr-code-container");
  modal.style.display = "block";
};

// View results
window.viewResults = async function (roundId) {
  const results = await getResults(roundId);
  if (!results) {
    alert(dashboardMessages.failedToLoadResults);
    return;
  }

  const spotifyTrackInfo = await getSpotifyTrackInfo(results.winner.spotifyId);
  if (!spotifyTrackInfo) {
    alert(dashboardMessages.failedToLoadSpotifyTrack);
    return;
  }

  const countdownData = await getRoundCountdown(roundId);
  const modal = document.getElementById("results-modal");
  const container = document.getElementById("results-container");

  let countdownHTML = "";
  if (
    countdownData &&
    countdownData.isJukeboxRound &&
    countdownData.timeRemainingSeconds !== null
  ) {
    const timeStr = formatTimeRemaining(countdownData.timeRemainingSeconds);
    const warningClass =
      countdownData.timeRemainingSeconds < 30 ? "countdown-warning" : "";
    countdownHTML = `
      <div class="countdown-section" style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; font-weight: bold;">⏱️ Voting ends in:</p>
        <p class="countdown-timer ${warningClass}" id="results-countdown-timer" style="font-size: 24px; font-weight: bold; margin: 0; color: #007bff;">${timeStr}</p>
        ${
          countdownData.nowPlaying
            ? `
          <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #666;">
            Currently playing: "${countdownData.nowPlaying.title}" by ${countdownData.nowPlaying.artist}
          </p>
        `
            : ""
        }
      </div>
    `;
  } else if (results.winner) {
    countdownHTML = `
      <div class="countdown-section" style="margin: 16px 0; padding: 12px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
        <p style="margin: 0; font-size: 0.9em; color: #92400e;">
          💡 <strong>Tip:</strong> Start the jukebox to enable countdown timers and automated playlist management.
        </p>
      </div>
    `;
  }

  container.innerHTML = `
    <p><strong>Round ${results.roundNumber}</strong></p>
    <p><strong>Total Votes:</strong> ${results.totalVotes}</p>
    ${countdownHTML}
    <div class="results-list">
      ${results.songs
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
      <div class="winner-section">
        <h4>Winner</h4>
        <p>"${results.winner.title}" by ${results.winner.artist}</p>
        ${
          results.winner.spotifyId && spotifyTrackInfo
            ? `
          <div style="margin: 16px 0;">
            <iframe 
              src="https://open.spotify.com/embed/track/${results.winner.spotifyId}" 
              width="100%" 
              height="352" 
              frameBorder="0" 
              allowtransparency="true" 
              allow="encrypted-media"
              style="border-radius: 8px;">
            </iframe>
          </div>
          <a href="https://open.spotify.com/track/${results.winner.spotifyId}" target="_blank" class="btn btn-small" style="margin-top: 8px;">
            Open in Spotify
          </a>
        `
            : results.winner.spotifyId
            ? `
          <p style="color: #666; font-size: 0.9em; margin-top: 8px;">
            Spotify track ID available but preview not accessible. 
            <a href="https://open.spotify.com/track/${results.winner.spotifyId}" target="_blank">Try opening in Spotify</a>
          </p>
        `
            : `
          <p style="color: #666; font-size: 0.9em; margin-top: 8px;">
            No Spotify track ID available for this song.
          </p>
        `
        }
      </div>
    `
        : ""
    }
  `;

  modal.style.display = "block";

  // Start countdown timer if available
  if (countdownData && countdownData.isJukeboxRound) {
    const timerEl = document.getElementById("results-countdown-timer");
    if (timerEl) {
      let currentSeconds = countdownData.timeRemainingSeconds;

      const updateTimer = () => {
        if (currentSeconds <= 0) {
          timerEl.textContent = "00:00";
          timerEl.className = "countdown-timer countdown-warning";
          return;
        }

        timerEl.textContent = formatTimeRemaining(currentSeconds);
        if (currentSeconds < 30) {
          timerEl.className = "countdown-timer countdown-warning";
        } else {
          timerEl.className = "countdown-timer";
        }
        currentSeconds--;
      };

      // Update immediately
      updateTimer();

      // Update every second
      const interval = setInterval(() => {
        updateTimer();
        if (currentSeconds <= 0) {
          clearInterval(interval);
          // Refresh countdown from server
          getRoundCountdown(roundId).then((data) => {
            if (data && data.isJukeboxRound) {
              currentSeconds = data.timeRemainingSeconds;
            }
          });
        }
      }, 1000);

      // Store interval ID to clear on modal close
      modal._countdownInterval = interval;
    }
  }
};

// Pause round
window.pauseRound = async function (roundId) {
  const { ok, data } = await updateRoundStatus(roundId, "paused");

  if (ok && data.success) {
    await loadAndDisplayRounds();
  } else {
    alert(dashboardMessages.failedToPauseRound + (data.message || dashboardMessages.unknownError));
  }
};

// Resume round
window.resumeRound = async function (roundId) {
  const { ok, data } = await updateRoundStatus(roundId, "active");

  if (ok && data.success) {
    await loadAndDisplayRounds();
  } else {
    alert(dashboardMessages.failedToResumeRound + (data.message || dashboardMessages.unknownError));
  }
};

// Start jukebox
window.startJukebox = async function (roundId) {
  if (
    !confirm(
      "Start jukebox mode? This will begin automated playlist management. The current round winner will start playing, and a new voting round will be generated automatically."
    )
  ) {
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "Starting...";

  try {
    const { ok, data } = await apiRequest("/api/v1/jukebox/start", {
      method: "POST",
      body: JSON.stringify({ roundId }),
    });

    if (ok && data.success) {
      alert(
        "Jukebox started successfully! The countdown timer will now appear on voting rounds."
      );
      await loadAndDisplayRounds();
    } else {
      alert("Failed to start jukebox: " + (data.message || "Unknown error"));
    }
  } catch (error) {
    alert("Error starting jukebox: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "🎧 Start Jukebox";
  }
};

// Generate next round
window.generateNext = async function (roundId) {
  if (
    !confirm(
      "Generate next round with AI? This will create 10 new songs based on voting patterns."
    )
  ) {
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = dashboardMessages.generating;

  const { ok, data } = await generateNextRound(roundId);

  if (ok && data.success) {
    alert(dashboardMessages.nextRoundGenerated);
    loadAndDisplayRounds();
  } else {
    alert(dashboardMessages.failedToGenerateNextRound + (data.message || dashboardMessages.unknownError));
  }

  btn.disabled = false;
  btn.textContent = dashboardMessages.generateNextRound;
};

// Load and display rounds
async function loadAndDisplayRounds() {
  const container = document.getElementById("rounds-container");
  if (container) {
    container.innerHTML = `<p class="loading">${dashboardMessages.loadingRounds}</p>`;
  }
  const rounds = await loadRounds();
  displayRounds(rounds);
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const backend = document.getElementById("backend-url");
  const createForm = document.getElementById("create-round-form");
  const createMessage = document.getElementById("create-message");
  const createBtn = document.getElementById("create-btn");

  if (backend) backend.textContent = window.getBackendUrl();

  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = "/index.html";
    return;
  }

  // Load user info
  const user = await loadUserInfo();

  // Initialize header with navigation links
  if (typeof initLoggedInHeader === 'function') {
    const additionalLinks = [
      { href: '/profile.html', text: 'Profile' }
    ];
    
    // Only add Admin link if user is an admin
    if (user && user.role === 'admin') {
      additionalLinks.push({ href: '/admin.html', text: 'Admin' });
    }
    
    await initLoggedInHeader(additionalLinks);
  }

  // Load rounds
  await loadAndDisplayRounds();

  // Setup health check button
  const healthCheckBtn = document.getElementById("health-check-btn");
  const healthStatus = document.getElementById("health-status");

  if (healthCheckBtn && healthStatus) {
    healthCheckBtn.addEventListener("click", async () => {
      // Disable button during check
      healthCheckBtn.disabled = true;
      healthCheckBtn.textContent = dashboardMessages.checking;
      healthStatus.classList.add('hidden');
      
      try {
        const response = await fetch(
          window.getBackendUrl() + "/api/v1/ai/health",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            mode: "cors",
            credentials: "omit",
          }
        );

        const data = await response.json();

        // Remove hidden class to show status
        healthStatus.classList.remove("hidden");

        if (response.ok && data.success && data.connected) {
          // AI is healthy
          healthStatus.className = "health-status health-status-success";
          healthStatus.innerHTML = `
            <strong>✓ AI Service is Healthy</strong>
            <p>The AI agent is connected and ready to process requests.</p>
          `;
        } else {
          // AI is not healthy
          healthStatus.className = "health-status health-status-error";
          const errorMsg =
            data.error || "The AI agent is not reachable or not connected.";
          healthStatus.innerHTML = `
            <strong>✗ AI Service is Unavailable</strong>
            <p>${errorMsg}</p>
          `;
        }
      } catch (error) {
        // Network or other error
        healthStatus.className = "health-status health-status-error";
        healthStatus.classList.remove("hidden");
        healthStatus.innerHTML = `
          <strong>✗ Connection Error</strong>
          <p>Unable to reach the backend server. Please check your connection or try again later.</p>
        `;
      } finally {
        // Re-enable button
        healthCheckBtn.disabled = false;
        healthCheckBtn.textContent = dashboardMessages.checkAiHealth;
      }
    });
  }

  // Setup create form
  if (createForm) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      createMessage.textContent = "";
      createMessage.className = "msg";
      createBtn.disabled = true;
      createBtn.textContent = dashboardMessages.creating;

      const formData = new FormData(createForm);
      const roundData = {
        genre: formData.get("genre"),
        bpm: formData.get("bpm"),
        artists: formData.get("artists"),
        mood: formData.get("mood"),
        energy: formData.get("energy"),
      };

      const { ok, data } = await createRound(roundData);

      if (ok && data.success) {
        createMessage.textContent = dashboardMessages.votingRoundCreated;
        createMessage.className = 'msg ok';
        createForm.reset();

        // Log the created round info

        await loadAndDisplayRounds();
      } else {
        createMessage.textContent = dashboardMessages.failedToCreateRound + (data.message || dashboardMessages.unknownError);
        createMessage.className = 'msg err';
      }

      createBtn.disabled = false;
      createBtn.textContent = dashboardMessages.createVotingRound;
    });
  }

  // Setup modal close buttons
  const qrModal = document.getElementById("qr-modal");
  const resultsModal = document.getElementById("results-modal");

  const closeQR = document.querySelector(".close");
  const closeResults = document.querySelector(".close-results");

  if (closeQR) {
    closeQR.addEventListener("click", () => {
      qrModal.style.display = "none";
    });
  }

  if (closeResults) {
    closeResults.addEventListener("click", () => {
      // Clear countdown timer if it exists
      if (resultsModal._countdownInterval) {
        clearInterval(resultsModal._countdownInterval);
        resultsModal._countdownInterval = null;
      }
      resultsModal.style.display = "none";
    });
  }

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === qrModal) {
      qrModal.style.display = "none";
    }
    if (e.target === resultsModal) {
      // Clear countdown timer if it exists
      if (resultsModal._countdownInterval) {
        clearInterval(resultsModal._countdownInterval);
        resultsModal._countdownInterval = null;
      }
      resultsModal.style.display = "none";
    }
  });
});
