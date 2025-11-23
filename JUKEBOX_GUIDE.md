# 🎧 Jukebox System Guide

## Overview

The Jukebox system creates an automated playlist experience where:
- **Now Playing**: The current song (from previous round winner)
- **Next Up**: The winner of the current voting round (ready to play next)
- **Voting Round**: Active round where users vote for the song after next

The system automatically advances when the current song finishes, generating new voting rounds continuously.

## Architecture

### State Management
- Each owner has one jukebox instance
- Jukebox state is stored in-memory (Map structure)
- Timer-based system tracks when songs end

### Flow
1. **Start**: Owner starts jukebox with a round that has a winner
2. **Initial Setup**: 
   - Winner becomes "Now Playing"
   - New voting round is generated automatically
3. **Song Ends**: Timer triggers automatically
   - Voting round winner moves to "Now Playing"
   - New voting round is generated
   - Timer resets for next song

## API Endpoints

### Owner Endpoints (Protected - Requires JWT)

#### Start Jukebox
```http
POST /api/jukebox/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "roundId": "round_id_here"
}
```

**Requirements:**
- Round must belong to the owner
- Round must have a winner (voting completed)

**Response:**
```json
{
  "success": true,
  "message": "Jukebox started successfully",
  "data": {
    "ownerId": "user_id",
    "isActive": true,
    "nowPlaying": {
      "roundId": "round_id",
      "roundNumber": 1,
      "song": {
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify_track_id",
        "spotifyUri": "spotify:track:id"
      },
      "startedAt": "2024-01-01T12:00:00.000Z",
      "durationMs": 180000,
      "endsAt": "2024-01-01T12:03:00.000Z"
    },
    "votingRound": {
      "roundId": "new_round_id",
      "roundNumber": 2
    }
  }
}
```

#### Get Jukebox Status
```http
GET /api/jukebox/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ownerId": "user_id",
    "isActive": true,
    "nowPlaying": { ... },
    "votingRound": { ... },
    "timeRemainingMs": 120000,
    "timeRemainingSeconds": 120,
    "progress": 33.33
  }
}
```

#### Stop Jukebox
```http
POST /api/jukebox/stop
Authorization: Bearer <token>
```

#### Skip Current Song
```http
POST /api/jukebox/skip
Authorization: Bearer <token>
```
Immediately advances to next song and generates new voting round.

#### Pause Jukebox
```http
POST /api/jukebox/pause
Authorization: Bearer <token>
```
Pauses the timer but keeps state. Song can be resumed later.

#### Resume Jukebox
```http
POST /api/jukebox/resume
Authorization: Bearer <token>
```
Resumes from where it was paused, recalculating remaining time.

### Public Endpoints (For Voting Page & Display)

#### Get Voting Round
```http
GET /api/jukebox/:ownerId/voting-round
```

Returns the current voting round that users can vote on.

**Response:**
```json
{
  "success": true,
  "data": {
    "round": {
      "id": "round_id",
      "status": "active",
      "currentRoundNumber": 2,
      "genre": "Pop",
      "bpm": 120,
      ...
    },
    "songs": [ ... ],
    "results": { ... }
  }
}
```

#### Get Now Playing
```http
GET /api/jukebox/:ownerId/now-playing
```

Returns the currently playing song with time remaining.

**Response:**
```json
{
  "success": true,
  "data": {
    "nowPlaying": {
      "roundId": "round_id",
      "roundNumber": 1,
      "song": {
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify_track_id",
        ...
      },
      "startedAt": "2024-01-01T12:00:00.000Z",
      "durationMs": 180000,
      "endsAt": "2024-01-01T12:03:00.000Z"
    },
    "timeRemainingMs": 120000,
    "timeRemainingSeconds": 120,
    "progress": 33.33
  }
}
```

## How It Works

### 1. Starting the Jukebox

```javascript
// Owner creates a round and waits for votes
const round = await createRound(ownerId, { genre: "Pop" });

// After voting completes, start jukebox
const response = await fetch('/api/jukebox/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ roundId: round.id })
});
```

### 2. Automatic Advancement

The system uses Node.js `setTimeout` to track when songs end:

1. When a song starts, calculate `endsAt = startedAt + durationMs`
2. Set timer: `setTimeout(() => advanceJukebox(), timeUntilEnd)`
3. When timer fires:
   - Get winner from voting round
   - Move winner to "Now Playing"
   - Generate new voting round
   - Set new timer

### 3. Integration with Spotify

- Gets track duration from Spotify API (`duration_ms`)
- Falls back to 3 minutes (180000ms) if Spotify fails
- Uses `spotifyId` to fetch track info

### 4. Voting Page Integration

Users can vote on the active voting round:

```javascript
// Get voting round for jukebox
const response = await fetch(`/api/jukebox/${ownerId}/voting-round`);
const { round, songs, results } = response.data;

// Display songs for voting
// Submit votes normally via /api/voting/rounds/:roundId/vote
```

## Frontend Integration Example

### Display Now Playing

```javascript
async function displayNowPlaying(ownerId) {
  const response = await fetch(`/api/jukebox/${ownerId}/now-playing`);
  const { nowPlaying, timeRemainingSeconds, progress } = response.data;
  
  // Update UI
  document.getElementById('song-title').textContent = nowPlaying.song.title;
  document.getElementById('artist').textContent = nowPlaying.song.artist;
  document.getElementById('time-remaining').textContent = 
    `${Math.floor(timeRemainingSeconds / 60)}:${timeRemainingSeconds % 60}`;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  
  // Embed Spotify player
  if (nowPlaying.song.spotifyId) {
    document.getElementById('spotify-player').src = 
      `https://open.spotify.com/embed/track/${nowPlaying.song.spotifyId}`;
  }
}

// Poll every second for updates
setInterval(() => displayNowPlaying(ownerId), 1000);
```

### Display Voting Round

```javascript
async function displayVotingRound(ownerId) {
  const response = await fetch(`/api/jukebox/${ownerId}/voting-round`);
  const { songs, results } = response.data;
  
  // Display songs for voting
  songs.forEach(song => {
    // Render song card with vote button
  });
}

// Poll every 5 seconds for updates
setInterval(() => displayVotingRound(ownerId), 5000);
```

## Important Notes

### Timer Accuracy
- Uses `setTimeout` which is approximate (not exact)
- For production, consider using a more precise timing mechanism
- Timer recalculates on resume to account for pause duration

### Error Handling
- If voting round has no winner, uses first song
- If Spotify API fails, uses default 3-minute duration
- If round generation fails, jukebox stops

### State Persistence
- **Current**: In-memory only (lost on server restart)
- **Future**: Consider database persistence for production

### Multiple Owners
- Each owner has independent jukebox
- No conflicts between different owners' jukeboxes

## Next Steps for Integration

1. **Frontend Dashboard**: Add jukebox controls (start/stop/pause/skip)
2. **Display Page**: Create public page showing now playing + voting
3. **Spotify Integration**: Connect to actual Spotify playback API (if available)
4. **WebSocket**: Consider real-time updates instead of polling
5. **Database**: Persist jukebox state for reliability

## Example Workflow

1. Owner creates round → Users vote → Round has winner
2. Owner starts jukebox with that round
3. Winner plays (3 minutes)
4. While playing, new voting round is active
5. When song ends:
   - Voting round winner becomes "Now Playing"
   - New voting round is generated
   - Cycle continues

This creates a continuous, automated playlist experience! 🎵

