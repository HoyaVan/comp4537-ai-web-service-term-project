const BACKEND_URL = (window.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Check if user is authenticated
function isAuthenticated() {
  try {
    const token = localStorage.getItem('token');
    return !!token;
  } catch (_) {
    return false;
  }
}

// Get token from localStorage
function getToken() {
  try {
    return localStorage.getItem('token');
  } catch (_) {
    return null;
  }
}

// Make authenticated API request
async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(BACKEND_URL + url, {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'include',
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Load user info
async function loadUserInfo() {
  const { ok, data } = await apiRequest('/api/auth/profile');
  if (ok && data.success) {
    const user = data.data;
    const userEmail = document.getElementById('user-email');
    if (userEmail) userEmail.textContent = user.email || 'User';
  }
}

// Create new voting round
async function createRound(roundData) {
  // Parse artists string into array
  const artists = roundData.artists 
    ? roundData.artists.split(',').map(a => a.trim()).filter(a => a)
    : [];

  const payload = {
    genre: roundData.genre || null,
    bpm: roundData.bpm ? parseInt(roundData.bpm) : null,
    artists: artists.length > 0 ? artists : [],
    mood: roundData.mood || null,
    energy: roundData.energy || null,
  };

  const { ok, data } = await apiRequest('/api/voting/rounds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return { ok, data };
}

// Load all rounds
async function loadRounds() {
  const { ok, data } = await apiRequest('/api/voting/rounds');
  if (ok && data.success) {
    return data.data || [];
  }
  return [];
}

// Get QR code data
async function getQRCode(roundId) {
  const { ok, data } = await apiRequest(`/api/voting/rounds/${roundId}/qr`);
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Generate QR code image
function generateQRCode(url, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<p>Generating QR code...</p>';
  
  QRCode.toDataURL(url, { width: 256, margin: 2 }, (error, dataUrl) => {
    if (error) {
      container.innerHTML = '<p>Error generating QR code</p>';
    } else {
      container.innerHTML = `<img src="${dataUrl}" alt="QR Code" style="max-width: 100%; height: auto;" />`;
    }
  });
}

// Generate next round
async function generateNextRound(roundId) {
  const { ok, data } = await apiRequest(`/api/voting/rounds/${roundId}/next-round`, {
    method: 'POST',
  });
  return { ok, data };
}

// Update round status
async function updateRoundStatus(roundId, status) {
  const { ok, data } = await apiRequest(`/api/voting/rounds/${roundId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return { ok, data };
}

// Get results
async function getResults(roundId) {
  const { ok, data } = await apiRequest(`/api/voting/rounds/${roundId}/results`);
  if (ok && data.success) {
    return data.data;
  }
  return null;
}

// Display rounds
function displayRounds(rounds) {
  const container = document.getElementById('rounds-container');
  if (!container) return;

  if (rounds.length === 0) {
    container.innerHTML = '<p class="no-rounds">No voting rounds yet. Create one above!</p>';
    return;
  }

  container.innerHTML = rounds.map(round => `
    <div class="round-card">
      <div class="round-header">
        <h3>Round ${round.currentRoundNumber}</h3>
        <span class="round-status ${round.status}">${round.status}</span>
      </div>
      <div class="round-info">
        ${round.genre ? `<p><strong>Genre:</strong> ${round.genre}</p>` : ''}
        ${round.bpm ? `<p><strong>BPM:</strong> ${round.bpm}</p>` : ''}
        ${round.artists && round.artists.length > 0 ? `<p><strong>Artists:</strong> ${round.artists.join(', ')}</p>` : ''}
        <p><strong>Total Votes:</strong> ${round.totalVotes || 0}</p>
        <p><strong>Songs:</strong> ${round.songCount || 0}</p>
      </div>
      ${round.winner ? `<p class="winner"><strong>Winner:</strong> "${round.winner.title}" by ${round.winner.artist}</p>` : ''}
      <div class="round-actions">
        <button class="btn btn-small" onclick="showQRCode('${round.id}')">Show QR Code</button>
        <button class="btn btn-small" onclick="viewResults('${round.id}')">View Results</button>
        ${round.status === 'active' ? `
          <button class="btn btn-small btn-warning" onclick="pauseRound('${round.id}')">Pause</button>
        ` : round.status === 'paused' ? `
          <button class="btn btn-small btn-success" onclick="resumeRound('${round.id}')">Resume</button>
        ` : ''}
        <button class="btn btn-small" onclick="generateNext('${round.id}')">Generate Next Round</button>
      </div>
    </div>
  `).join('');
}

// Show QR code modal
window.showQRCode = async function(roundId) {
  const qrData = await getQRCode(roundId);
  if (!qrData) {
    alert('Failed to get QR code');
    return;
  }

  const modal = document.getElementById('qr-modal');
  const urlEl = document.getElementById('qr-url');
  const container = document.getElementById('qr-code-container');
  
  if (urlEl) urlEl.textContent = qrData.votingUrl;
  generateQRCode(qrData.votingUrl, 'qr-code-container');
  modal.style.display = 'block';
};

// View results
window.viewResults = async function(roundId) {
  const results = await getResults(roundId);
  if (!results) {
    alert('Failed to load results');
    return;
  }

  const modal = document.getElementById('results-modal');
  const container = document.getElementById('results-container');
  
  container.innerHTML = `
    <p><strong>Round ${results.roundNumber}</strong></p>
    <p><strong>Total Votes:</strong> ${results.totalVotes}</p>
    <div class="results-list">
      ${results.songs.map((song, index) => `
        <div class="result-item ${index === 0 ? 'winner' : ''}">
          <span class="rank">#${index + 1}</span>
          <span class="song-info">"${song.title}" by ${song.artist}</span>
          <span class="votes">${song.votes} votes</span>
        </div>
      `).join('')}
    </div>
    ${results.winner ? `
      <div class="winner-section">
        <h4>Winner</h4>
        <p>"${results.winner.title}" by ${results.winner.artist}</p>
        ${results.winner.spotifyId ? `
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
        ` : ''}
      </div>
    ` : ''}
  `;
  
  modal.style.display = 'block';
};

// Pause round
window.pauseRound = async function(roundId) {
  const { ok, data } = await updateRoundStatus(roundId, 'paused');
  
  if (ok && data.success) {
    await loadAndDisplayRounds();
  } else {
    alert('Failed to pause round: ' + (data.message || 'Unknown error'));
  }
};

// Resume round
window.resumeRound = async function(roundId) {
  const { ok, data } = await updateRoundStatus(roundId, 'active');
  
  if (ok && data.success) {
    await loadAndDisplayRounds();
  } else {
    alert('Failed to resume round: ' + (data.message || 'Unknown error'));
  }
};

// Generate next round
window.generateNext = async function(roundId) {
  if (!confirm('Generate next round with AI? This will create 10 new songs based on voting patterns.')) {
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Generating...';

  const { ok, data } = await generateNextRound(roundId);
  
  if (ok && data.success) {
    alert('Next round generated successfully!');
    loadAndDisplayRounds();
  } else {
    alert('Failed to generate next round: ' + (data.message || 'Unknown error'));
  }
  
  btn.disabled = false;
  btn.textContent = 'Generate Next Round';
};

// Load and display rounds
async function loadAndDisplayRounds() {
  const container = document.getElementById('rounds-container');
  if (container) {
    container.innerHTML = '<p class="loading">Loading rounds...</p>';
  }
  const rounds = await loadRounds();
  displayRounds(rounds);
}

// Logout function
function logout() {
  try {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
  } catch (_) {
    window.location.href = '/index.html';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const backend = document.getElementById('backend-url');
  const logoutBtn = document.getElementById('logout-btn');
  const createForm = document.getElementById('create-round-form');
  const createMessage = document.getElementById('create-message');
  const createBtn = document.getElementById('create-btn');

  if (backend) backend.textContent = BACKEND_URL;

  // Check authentication
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return;
  }

  // Load user info
  await loadUserInfo();

  // Load rounds
  await loadAndDisplayRounds();

  // Setup logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Setup create form
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      createMessage.textContent = '';
      createMessage.className = 'msg';
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      const formData = new FormData(createForm);
      const roundData = {
        genre: formData.get('genre'),
        bpm: formData.get('bpm'),
        artists: formData.get('artists'),
        mood: formData.get('mood'),
        energy: formData.get('energy'),
      };

      const { ok, data } = await createRound(roundData);

      if (ok && data.success) {
        createMessage.textContent = 'Voting round created successfully!';
        createMessage.className = 'msg ok';
        createForm.reset();
        await loadAndDisplayRounds();
      } else {
        createMessage.textContent = 'Failed to create round: ' + (data.message || 'Unknown error');
        createMessage.className = 'msg err';
      }

      createBtn.disabled = false;
      createBtn.textContent = 'Create Voting Round';
    });
  }

  // Setup modal close buttons
  const qrModal = document.getElementById('qr-modal');
  const resultsModal = document.getElementById('results-modal');
  
  const closeQR = document.querySelector('.close');
  const closeResults = document.querySelector('.close-results');
  
  if (closeQR) {
    closeQR.addEventListener('click', () => {
      qrModal.style.display = 'none';
    });
  }
  
  if (closeResults) {
    closeResults.addEventListener('click', () => {
      resultsModal.style.display = 'none';
    });
  }

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      qrModal.style.display = 'none';
    }
    if (e.target === resultsModal) {
      resultsModal.style.display = 'none';
    }
  });
});

