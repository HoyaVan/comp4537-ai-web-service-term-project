# Spotify Playlist Integration Flow

## Overview
When a song wins a voting round in the jukebox, it is automatically added to the user's Spotify playlist. The playlist is created per session (one per day) and tracks are added as they win.

## Flow Diagram

```
1. User connects Spotify account (OAuth)
   ↓
2. User creates voting round → Jukebox starts
   ↓
3. Voting round ends → Winner determined
   ↓
4. Jukebox advances → Winner becomes "now playing"
   ↓
5. System checks: User connected to Spotify?
   ↓ YES
6. Get or create playlist for today's session
   ↓
7. Add winning song to playlist
   ↓
8. Continue jukebox flow (generate next round)
```

## Implementation Details

### 1. OAuth Scopes
The Spotify OAuth flow now requests these scopes:
- `user-read-private` - Read user profile
- `user-read-email` - Read user email
- `playlist-modify-public` - Create/modify public playlists
- `playlist-modify-private` - Create/modify private playlists
- `playlist-read-private` - Read user's private playlists

**Location:** `backend/src/services/spotifyService.js` - `getAuthorizationURL()`

### 2. Spotify Service Methods Added

#### `getUserProfile(userAccessToken)`
- Gets the authenticated user's Spotify profile
- Returns: `{ id, display_name, email, external_urls, images }`
- Used to get the Spotify user ID for playlist creation

#### `createPlaylist(userAccessToken, userId, name, description, isPublic)`
- Creates a new playlist for the user
- Returns: `{ id, name, description, external_urls, public, tracks }`
- Playlists are created as public by default

#### `addTracksToPlaylist(userAccessToken, playlistId, trackUris)`
- Adds tracks to a playlist
- Handles batching (max 100 tracks per request)
- Returns: `{ total_tracks_added, batches }`

#### `getUserPlaylistByName(userAccessToken, playlistName)`
- Searches user's playlists to find existing playlist
- Returns playlist object if found, `null` otherwise
- Used to avoid creating duplicate playlists for the same day

**Location:** `backend/src/services/spotifyService.js`

### 3. Jukebox Service Functions

#### `getOrCreateJukeboxPlaylist(ownerId)`
- Gets user's Spotify tokens from database
- Refreshes token if expired
- Gets user's Spotify profile
- Searches for existing playlist with today's date
- Creates new playlist if not found
- Returns: Playlist object or `null` if user not connected

#### `addWinnerToPlaylist(ownerId, winnerSong)`
- Gets or creates playlist for user
- Refreshes token if needed
- Adds winning song's `spotifyUri` to playlist
- Returns: `true` if successful, `false` otherwise
- Fails silently (doesn't break jukebox if playlist fails)

**Location:** `backend/src/services/jukeboxService.js`

### 4. Integration Points

#### When Jukebox Starts (`startJukebox`)
- When starting with an existing round that has a winner
- The initial winning song is added to playlist (async, non-blocking)

#### When Jukebox Advances (`advanceJukebox`)
- After determining the winner from voting round
- Before setting up the next voting round
- Winning song is added to playlist (async, non-blocking)

**Location:** `backend/src/services/jukeboxService.js` - `advanceJukebox()` and `startJukebox()`

## Playlist Naming Convention

Playlists are named with the date and voting round criteria: **"DJ Clownfish - {Date} - {Criteria}"**

### Format
- Base: `DJ Clownfish - {Date}`
- Criteria (if available): `{Genre} • {Artists} • {Mood} • {Energy} • {BPM} BPM`
- Separator: ` • ` (bullet point)

### Examples

**With all criteria:**
```
DJ Clownfish - Nov 23, 2025 - EDM • Tiësto, Martin Garrix • Energetic • High • 128 BPM
```

**With genre and artists only:**
```
DJ Clownfish - Nov 23, 2025 - Pop • Taylor Swift, Ed Sheeran
```

**With genre only:**
```
DJ Clownfish - Nov 23, 2025 - Rock
```

**No criteria (fallback):**
```
DJ Clownfish - Nov 23, 2025
```

### Description Format

The playlist description includes:
- Date of session
- All selected criteria (Genre, Artists, Mood, Energy, BPM)
- Note that songs are added automatically

Example:
```
Auto-generated playlist from DJ Clownfish jukebox session on Nov 23, 2025. Criteria: Genre: EDM • Artists: Tiësto, Martin Garrix • Mood: Energetic • Energy: High • BPM: 128. Songs are added automatically as they win voting rounds.
```

### Notes
- Playlist names are limited to 100 characters (Spotify API limit)
- If the name exceeds 100 characters, criteria are truncated
- Only first 2 artists are included to keep names concise
- "Any" values for mood/energy are excluded from the name

## Token Management

### Token Storage
- User's Spotify tokens are stored in the `user` table:
  - `spotify_access_token` (TEXT)
  - `spotify_refresh_token` (TEXT)
  - `spotify_token_expires_at` (TIMESTAMP)

### Token Refresh
- Before any Spotify API call, the system checks if the token is expired
- If expired and a refresh token exists, it automatically refreshes
- Updated tokens are saved back to the database
- If refresh fails, playlist operations are skipped (non-blocking)

## Error Handling

### Graceful Degradation
- If user is not connected to Spotify → Playlist operations are skipped
- If token refresh fails → Playlist operations are skipped
- If playlist creation fails → Jukebox continues normally
- If adding track fails → Jukebox continues normally

All errors are logged but do not interrupt the jukebox flow.

## Database Schema

The following columns were added to the `user` table:
```sql
ALTER TABLE `user`
ADD COLUMN `spotify_access_token` TEXT NULL,
ADD COLUMN `spotify_refresh_token` TEXT NULL,
ADD COLUMN `spotify_token_expires_at` TIMESTAMP NULL;
```

## Testing the Flow

1. **Connect Spotify Account:**
   - User clicks "Connect Spotify" in dashboard
   - OAuth flow completes
   - Tokens stored in database

2. **Start Jukebox:**
   - Create a voting round
   - Jukebox auto-starts with random song
   - First voting round is created

3. **Vote and Win:**
   - Users vote on songs
   - When voting round ends, winner is determined
   - Jukebox advances to next song
   - **Winner is automatically added to Spotify playlist**

4. **Verify:**
   - Check user's Spotify account
   - Look for playlist named "DJ Clownfish Session - {Today's Date}"
   - Verify winning songs are in the playlist

## Future Enhancements

Potential improvements:
- Store playlist ID in jukebox state for faster lookups
- Add option to create one playlist per jukebox session vs. per day
- Add UI to show playlist link in dashboard
- Add option to make playlists private
- Add endpoint to manually generate playlist from all winners

