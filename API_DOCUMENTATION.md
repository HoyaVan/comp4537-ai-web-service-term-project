# DJ Clownfish API Documentation

## Base URL
- Development: `http://localhost:3000`
- Production: `https://your-production-url.com`

## Authentication

### JWT Bearer Token
Most protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

Tokens are obtained from `/api/auth/login` or `/api/auth/signup`.

### API Key
AI agent endpoints require an API key in the header:
```
X-API-Key: <your-api-key>
```

---

## Authentication Endpoints

### POST `/api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST `/api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### GET `/api/auth/profile`
Get current user profile with API consumption stats. **Requires authentication.**

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "apiConsumption": {
      "callsUsed": 5,
      "callsLimit": 20,
      "remainingCalls": 15,
      "hasExceededLimit": false,
      "hasUnlimitedCalls": false,
      "endpointBreakdown": []
    }
  }
}
```

### GET `/api/auth/users`
Get all users. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    }
  ],
  "count": 1
}
```

---

## AI Agent Endpoints

### GET `/api/ai/health`
Check AI agent connection status.

**Response (200):**
```json
{
  "success": true,
  "connected": true
}
```

### POST `/api/ai/chat`
Send a message to the AI agent. **Requires API key.**

**Headers:**
```
X-API-Key: <your-api-key>
```

**Request Body:**
```json
{
  "message": "Generate 10 pop songs with high energy",
  "prompt": "You are a music recommendation assistant"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": "Here are 10 high-energy pop songs..."
  }
}
```

### POST `/api/ai/call`
Call a specific AI agent endpoint. **Requires API key.**

**Headers:**
```
X-API-Key: <your-api-key>
```

**Request Body:**
```json
{
  "endpoint": "/v2/ai/agents/{agent_id}/chat",
  "method": "POST",
  "data": {
    "message": "Generate songs"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": "..."
  }
}
```

---

## Voting Endpoints

### POST `/api/voting/rounds`
Create a new voting round. **Requires authentication.**

**Request Body:**
```json
{
  "genre": "Pop",
  "bpm": 120,
  "artists": ["Artist 1", "Artist 2"],
  "mood": "energetic",
  "energy": "high"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Voting round created successfully",
  "data": {
    "round": {
      "id": "round123",
      "ownerId": "user123",
      "status": "active",
      "currentRoundNumber": 1,
      "genre": "Pop",
      "bpm": 120,
      "artists": ["Artist 1", "Artist 2"],
      "mood": "energetic",
      "energy": "high",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "songs": [
      {
        "id": "song1",
        "roundId": "round123",
        "roundNumber": 1,
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify:track:123",
        "spotifyUri": "spotify:track:123",
        "previewUrl": "https://...",
        "albumArt": "https://..."
      }
    ],
    "jukebox": null
  }
}
```

### GET `/api/voting/rounds`
Get all rounds for the authenticated owner. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "round123",
      "ownerId": "user123",
      "status": "active",
      "currentRoundNumber": 1,
      "genre": "Pop",
      "songCount": 10,
      "totalVotes": 5,
      "winner": null,
      "_isJukeboxVotingRound": false
    }
  ]
}
```

### GET `/api/voting/rounds/:roundId`
Get round details (public endpoint for voting page).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "round": {
      "id": "round123",
      "status": "active",
      "currentRoundNumber": 1,
      "genre": "Pop",
      "bpm": 120,
      "artists": ["Artist 1"],
      "mood": "energetic",
      "energy": "high"
    },
    "songs": [
      {
        "id": "song1",
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify:track:123",
        "previewUrl": "https://...",
        "albumArt": "https://..."
      }
    ],
    "results": {
      "roundId": "round123",
      "roundNumber": 1,
      "totalVotes": 5,
      "winner": null,
      "songs": []
    }
  }
}
```

### POST `/api/voting/rounds/:roundId/vote`
Submit a vote for a song. **Public endpoint.**

**Request Body:**
```json
{
  "songId": "song1",
  "participantToken": "optional_token"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Vote submitted successfully",
  "data": {
    "participantToken": "token123",
    "results": {
      "roundId": "round123",
      "roundNumber": 1,
      "totalVotes": 6,
      "winner": null,
      "songs": [
        {
          "song": {
            "id": "song1",
            "title": "Song Title",
            "artist": "Artist Name"
          },
          "votes": 3,
          "percentage": 50
        }
      ]
    }
  }
}
```

### GET `/api/voting/rounds/:roundId/results`
Get detailed voting results. **Requires authentication (owner only).**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "roundId": "round123",
    "roundNumber": 1,
    "totalVotes": 10,
    "winner": {
      "id": "song1",
      "title": "Winner Song",
      "artist": "Winner Artist"
    },
    "songs": [
      {
        "song": {
          "id": "song1",
          "title": "Song Title",
          "artist": "Artist Name"
        },
        "votes": 5,
        "percentage": 50
      }
    ]
  }
}
```

### GET `/api/voting/rounds/:roundId/public-results`
Get public voting results. **Public endpoint.**

**Response (200):**
Same format as `/results` endpoint.

### POST `/api/voting/rounds/:roundId/next-round`
Generate next round with AI based on previous voting patterns. **Requires authentication (owner only).**

**Response (200):**
```json
{
  "success": true,
  "message": "Next round generated successfully",
  "data": {
    "round": {
      "id": "round123",
      "currentRoundNumber": 2,
      "status": "active"
    },
    "songs": []
  }
}
```

### PATCH `/api/voting/rounds/:roundId/status`
Update round status. **Requires authentication (owner only).**

**Request Body:**
```json
{
  "status": "paused"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Round status updated successfully"
}
```

### GET `/api/voting/rounds/:roundId/qr`
Get QR code data for voting page. **Requires authentication (owner only).**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "http://localhost:8080/vote.html?round=round123",
    "qrCodeData": "data:image/png;base64,..."
  }
}
```

### GET `/api/voting/spotify/search`
Search Spotify tracks. **Requires authentication.**

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "spotify:track:123",
      "name": "Song Name",
      "artists": ["Artist Name"],
      "album": {
        "name": "Album Name",
        "images": [{"url": "https://..."}]
      },
      "preview_url": "https://...",
      "external_urls": {
        "spotify": "https://open.spotify.com/track/123"
      }
    }
  ]
}
```

### GET `/api/voting/spotify/tracks/:trackId`
Get Spotify track information. **Public endpoint.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "spotify:track:123",
    "name": "Song Name",
    "artists": ["Artist Name"],
    "album": {
      "name": "Album Name",
      "images": [{"url": "https://..."}]
    },
    "preview_url": "https://...",
    "external_urls": {
      "spotify": "https://open.spotify.com/track/123"
    }
  }
}
```

---

## Spotify Endpoints

### GET `/api/spotify/search`
Search Spotify tracks. **Public endpoint.**

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 10)

**Response (200):**
Same format as `/api/voting/spotify/search`

### GET `/api/spotify/tracks/:trackId`
Get Spotify track information. **Public endpoint.**

**Response (200):**
Same format as `/api/voting/spotify/tracks/:trackId`

### GET `/api/spotify/auth`
Initiate Spotify OAuth flow. Redirects to Spotify authorization page.

**Query Parameters:**
- `state` (optional): State parameter for OAuth
- `scopes` (optional): Comma-separated list of scopes

### GET `/api/spotify/callback`
Handle Spotify OAuth callback.

**Query Parameters:**
- `code` (required): Authorization code from Spotify
- `state` (optional): State parameter
- `error` (optional): Error from Spotify

**Response (200):**
```json
{
  "success": true,
  "message": "Spotify OAuth successful",
  "data": {
    "access_token": "token123",
    "refresh_token": "refresh123",
    "expires_in": 3600,
    "token_type": "Bearer",
    "scope": "user-read-playback-state",
    "state": null
  }
}
```

### GET `/api/spotify/token`
Get current Spotify token information.

**Response (200):**
```json
{
  "success": true,
  "message": "Spotify token retrieved successfully",
  "data": {
    "access_token": "token123",
    "refresh_token": "refresh123",
    "expires_in": 3600,
    "token_type": "Bearer",
    "scope": "user-read-playback-state"
  }
}
```

---

## Admin Endpoints

All admin endpoints require authentication and admin role.

### GET `/api/admin/stats/endpoints`
Get API endpoint statistics.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "method": "POST",
      "endpoint": "/api/voting/rounds",
      "requests": 10,
      "users": [
        {
          "userId": "user123",
          "name": "John Doe",
          "email": "user@example.com",
          "count": 5
        }
      ],
      "lastCall": {
        "userId": "user123",
        "email": "user@example.com",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "count": 1
}
```

### GET `/api/admin/stats/users`
Get user API consumption statistics.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user123",
      "name": "John Doe",
      "email": "user@example.com",
      "totalRequests": 15
    }
  ],
  "count": 1
}
```

### GET `/api/admin/stats/logs`
Get all API call logs.

**Query Parameters:**
- `limit` (optional): Maximum number of logs to return (default: 100)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "method": "POST",
      "endpoint": "/api/voting/rounds",
      "userId": "user123",
      "statusCode": 201,
      "responseTime": 150,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST `/api/admin/users/:userId/reset-api-count`
Reset API call count for a user.

**Response (200):**
```json
{
  "success": true,
  "message": "API call count reset for user user123"
}
```

---

## Jukebox Endpoints

### POST `/api/jukebox/start`
Start jukebox mode. **Requires authentication.**

**Request Body:**
```json
{
  "roundId": "round123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Jukebox started successfully",
  "data": {
    "ownerId": "user123",
    "isActive": true,
    "votingRound": {
      "roundId": "round123",
      "roundNumber": 1
    },
    "nowPlaying": {
      "song": {
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify:track:123"
      },
      "startTime": "2024-01-01T00:00:00.000Z",
      "durationMs": 180000
    }
  }
}
```

### GET `/api/jukebox/status`
Get jukebox status. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "ownerId": "user123",
    "isActive": true,
    "votingRound": {
      "roundId": "round123",
      "roundNumber": 1
    },
    "nowPlaying": {
      "song": {
        "title": "Song Title",
        "artist": "Artist Name"
      },
      "timeRemainingMs": 120000,
      "timeRemainingSeconds": 120,
      "progress": 0.33
    }
  }
}
```

### POST `/api/jukebox/stop`
Stop jukebox. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "message": "Jukebox stopped successfully"
}
```

### POST `/api/jukebox/skip`
Skip current song. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "message": "Song skipped successfully",
  "data": {
    "nowPlaying": {
      "song": {
        "title": "Next Song",
        "artist": "Next Artist"
      }
    }
  }
}
```

### POST `/api/jukebox/pause`
Pause jukebox. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "message": "Jukebox paused successfully"
}
```

### POST `/api/jukebox/resume`
Resume jukebox. **Requires authentication.**

**Response (200):**
```json
{
  "success": true,
  "message": "Jukebox resumed successfully"
}
```

### GET `/api/jukebox/:ownerId/voting-round`
Get voting round for jukebox. **Public endpoint.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "round": {
      "id": "round123",
      "status": "active",
      "currentRoundNumber": 1,
      "genre": "Pop",
      "bpm": 120,
      "artists": ["Artist 1"],
      "mood": "energetic",
      "energy": "high"
    },
    "songs": [],
    "results": {
      "roundId": "round123",
      "roundNumber": 1,
      "totalVotes": 0,
      "winner": null,
      "songs": []
    }
  }
}
```

### GET `/api/jukebox/:ownerId/now-playing`
Get currently playing song. **Public endpoint.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nowPlaying": {
      "song": {
        "title": "Song Title",
        "artist": "Artist Name",
        "spotifyId": "spotify:track:123"
      }
    },
    "timeRemainingMs": 120000,
    "timeRemainingSeconds": 120,
    "progress": 0.33
  }
}
```

---

## Health Endpoints

### GET `/health`
Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/`
Server status endpoint.

**Response (200):**
```json
{
  "message": "Server is running!"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error information (optional)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (API limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable (AI agent not reachable)

---

## Rate Limiting

- Free users: 20 API calls per user
- Admin users: Unlimited API calls
- Rate limit applies to authenticated endpoints only
- Public endpoints (voting, public results) are not rate limited

---

## Interactive API Documentation

Visit `/doc/` endpoint for interactive Swagger UI documentation where you can:
- Browse all endpoints
- See request/response schemas
- Test endpoints directly from the browser
- View authentication requirements

Example: `http://localhost:3000/doc/`

