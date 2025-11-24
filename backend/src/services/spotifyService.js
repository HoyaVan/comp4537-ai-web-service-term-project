const axios = require("axios");
const dotenv = require("dotenv");
const spotifyMessages = require("../messages/spotify");

class SpotifyService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || null;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || null;
    this.baseURL = "https://api.spotify.com/v1";
    this.tokenURL = "https://accounts.spotify.com/api/token";
    this.authURL = "https://accounts.spotify.com/authorize";
    
    // Construct callback URI from BACKEND_URL or use explicit SPOTIFY_CALLBACK_URI
    const backendUrl = process.env.BACKEND_URL || process.env.SPOTIFY_CALLBACK_URI || null;
    if (backendUrl) {
      // If SPOTIFY_CALLBACK_URI is explicitly set, use it
      if (process.env.SPOTIFY_CALLBACK_URI) {
        this.callbackURI = process.env.SPOTIFY_CALLBACK_URI;
      } else {
        // Otherwise, construct from BACKEND_URL
        const baseUrl = backendUrl.replace(/\/$/, ''); // Remove trailing slash
        this.callbackURI = `${baseUrl}/api/v1/spotify/oauth/callback`;
      }
    } else {
      this.callbackURI = null;
    }
    // OAuth tokens (from user authorization)
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresIn = null;
    this.tokenExpiresAt = null;
    this.tokenType = null;
    this.scope = null;
    this.state = null;
    // Client credentials tokens (for app-only access)
    this.clientCredentialsToken = null;
    this.clientCredentialsExpiresAt = null;
  }


  /**
   * Get a valid access token - prefers OAuth token if available, otherwise uses client credentials
   */
  async getValidAccessToken() {
    // Check if OAuth token exists and is still valid
    if (this.accessToken) {
      // If we have tokenExpiresAt, use it; otherwise calculate from expiresIn
      let expiresAt = this.tokenExpiresAt;
      if (!expiresAt && this.expiresIn) {
        expiresAt = Date.now() + (this.expiresIn * 1000);
        this.tokenExpiresAt = expiresAt;
      }
      
      // If we have expiration info and token is still valid, use it
      if (expiresAt && Date.now() < expiresAt) {
        console.log("Using OAuth access token (expires in", Math.round((expiresAt - Date.now()) / 1000), "seconds)");
        return this.accessToken;
      }
      
      // Token expired or no expiration info, try to refresh if we have refresh token
      if (this.refreshToken) {
        try {
          console.log("OAuth token expired, attempting refresh...");
          const refreshed = await this.refreshAccessToken(this.refreshToken);
          this.accessToken = refreshed.access_token;
          this.expiresIn = refreshed.expires_in;
          this.tokenExpiresAt = Date.now() + (refreshed.expires_in * 1000);
          if (refreshed.refresh_token) {
            this.refreshToken = refreshed.refresh_token;
          }
          console.log("OAuth token refreshed successfully");
          return this.accessToken;
        } catch (error) {
          console.error("Failed to refresh OAuth token, falling back to client credentials:", error.message);
          // Fall through to client credentials flow
        }
      } else if (!expiresAt) {
        // No expiration info and no refresh token, but we have a token - try using it
        console.log("Using OAuth token without expiration info");
        return this.accessToken;
      }
    }

    // Fall back to client credentials flow
    console.log("Using client credentials token");
    return await this.getClientCredentialsToken();
  }

  /**
   * Get access token using client credentials flow
   */
  async getClientCredentialsToken() {
    // Return cached client credentials token if still valid
    if (
      this.clientCredentialsToken &&
      this.clientCredentialsExpiresAt &&
      Date.now() < this.clientCredentialsExpiresAt
    ) {
      return this.clientCredentialsToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(spotifyMessages.spotifyCredentialsNotConfigured);
    }

    try {
      const response = await axios.post(
        this.tokenURL,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`
            ).toString("base64")}`,
          },
        }
      );

      this.clientCredentialsToken = response.data.access_token;
      // Set expiration
      this.clientCredentialsExpiresAt = Date.now() + response.data.expires_in * 1000;

      return this.clientCredentialsToken;
    } catch (error) {
      console.error(
        "Error getting Spotify access token:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToAuthenticateWithSpotify);
    }
  }

  /**
   * Get access token using client credentials flow (legacy method for backward compatibility)
   */
  async getAccessToken() {
    return await this.getValidAccessToken();
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 10) {
    try {
      const token = await this.getValidAccessToken();

      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          q: query,
          type: "track",
          limit: limit,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.tracks.items.map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        images: track.album.images,
      }));
    } catch (error) {
      console.error(
        "Error searching Spotify tracks:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToSearchSpotifyTracks);
    }
  }

  /**
   * Get track by ID
   */
  async getTrack(trackId) {
    try {
      const token = await this.getValidAccessToken();

      console.log(`Fetching Spotify track: ${trackId}`);

      const response = await axios.get(`${this.baseURL}/tracks/${trackId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const track = response.data;
      return {
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        images: track.album.images,
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      const statusCode = error.response?.status;
      console.error(
        `Error getting Spotify track (${trackId}):`,
        `Status: ${statusCode}`,
        `Error: ${JSON.stringify(errorDetails)}`
      );
      
      // Provide more detailed error message
      let errorMessage = spotifyMessages.failedToGetSpotifyTrack;
      if (error.response?.data?.error) {
        errorMessage = `Spotify API error: ${error.response.data.error.message || error.response.data.error}`;
      } else if (error.response?.status === 401) {
        errorMessage = "Spotify authentication failed. Please reconnect to Spotify.";
      } else if (error.response?.status === 404) {
        errorMessage = "Track not found on Spotify.";
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Get multiple tracks by IDs
   */
  async getTracks(trackIds) {
    try {
      const token = await this.getValidAccessToken();
      const response = await axios.get(`${this.baseURL}/tracks`, {
        params: {
          ids: trackIds.join(","),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.tracks.map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
        images: track.album.images,
      }));
    } catch (error) {
      console.error(
        "Error getting Spotify tracks:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToGetSpotifyTracks);
    }
  }

  /**
   * Generate OAuth authorization URL
   * Includes playlist scopes for creating and managing playlists
   * Includes playback control scope for adding songs to queue
   */
  getAuthorizationURL(
    state = null,
    scopes = [
      "user-read-private",
      "user-read-email",
      "playlist-modify-public",
      "playlist-modify-private",
      "playlist-read-private",
      "user-modify-playback-state",
      "user-read-playback-state"
    ]
  ) {
    if (!this.clientId) {
      throw new Error(spotifyMessages.spotifyClientIdNotConfigured);
    }

    if (!this.callbackURI) {
      const errorMsg = spotifyMessages.spotifyCallbackUriNotConfigured + 
        ". Please set SPOTIFY_CALLBACK_URI environment variable to your backend URL + /api/v1/spotify/oauth/callback" +
        " (e.g., https://your-backend.com/api/v1/spotify/oauth/callback)";
      throw new Error(errorMsg);
    }

    console.log('[SpotifyService] Using callback URI:', this.callbackURI);
    console.log('[SpotifyService] Make sure this exact URI is registered in your Spotify app settings');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.callbackURI,
      scope: scopes.join(" "),
    });

    if (state) {
      params.append("state", state);
    }

    return `${this.authURL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (OAuth flow)
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(spotifyMessages.spotifyCredentialsNotConfigured);
    }

    if (!this.callbackURI) {
      throw new Error(spotifyMessages.spotifyCallbackUriNotConfigured);
    }

    try {
      const response = await axios.post(
        this.tokenURL,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.callbackURI,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`
            ).toString("base64")}`,
          },
        }
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
        scope: response.data.scope,
      };
    } catch (error) {
      console.error(
        "Error exchanging code for token:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToExchangeCodeForToken);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(spotifyMessages.spotifyCredentialsNotConfigured);
    }

    try {
      const response = await axios.post(
        this.tokenURL,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`
            ).toString("base64")}`,
          },
        }
      );

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
        scope: response.data.scope,
        refresh_token: response.data.refresh_token || refreshToken, // Spotify may or may not return a new refresh token
      };
    } catch (error) {
      console.error(
        "Error refreshing access token:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToRefreshAccessToken);
    }
  }

  /**
   * Get current user's Spotify profile (requires user OAuth token)
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @returns {Promise<Object>} User profile with id, display_name, email, etc.
   */
  async getUserProfile(userAccessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/me`, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      });

      return {
        id: response.data.id,
        display_name: response.data.display_name,
        email: response.data.email,
        external_urls: response.data.external_urls,
        images: response.data.images,
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      const statusCode = error.response?.status;
      
      console.error(
        "Error getting Spotify user profile:",
        `Status: ${statusCode}`,
        `Error: ${JSON.stringify(errorDetails)}`
      );
      
      // Provide more specific error messages
      let errorMessage = "Failed to get Spotify user profile";
      if (statusCode === 401) {
        errorMessage = "Spotify authentication failed. Please reconnect to Spotify.";
      } else if (statusCode === 403) {
        errorMessage = "Spotify access denied. Please check your app permissions in Spotify Developer Dashboard.";
      } else if (errorDetails?.error?.message) {
        errorMessage = `Spotify API error: ${errorDetails.error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Create a new playlist for the user
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @param {string} userId - Spotify user ID
   * @param {string} name - Playlist name
   * @param {string} description - Playlist description
   * @param {boolean} isPublic - Whether playlist is public (default: true)
   * @returns {Promise<Object>} Created playlist with id, name, external_urls, etc.
   */
  async createPlaylist(userAccessToken, userId, name, description = "", isPublic = true) {
    try {
      const response = await axios.post(
        `${this.baseURL}/users/${userId}/playlists`,
        {
          name: name,
          description: description,
          public: isPublic,
        },
        {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        external_urls: response.data.external_urls,
        public: response.data.public,
        tracks: response.data.tracks,
      };
    } catch (error) {
      console.error(
        "Error creating Spotify playlist:",
        error.response?.data || error.message
      );
      throw new Error("Failed to create Spotify playlist");
    }
  }

  /**
   * Add tracks to a playlist
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @param {string} playlistId - Spotify playlist ID
   * @param {Array<string>} trackUris - Array of Spotify track URIs (e.g., ["spotify:track:xxx"])
   * @returns {Promise<Object>} Snapshot ID and tracks added
   */
  async addTracksToPlaylist(userAccessToken, playlistId, trackUris) {
    if (!trackUris || trackUris.length === 0) {
      throw new Error("No track URIs provided");
    }

    // Spotify API limit: max 100 tracks per request
    const maxTracksPerRequest = 100;
    const results = [];

    try {
      // Add tracks in batches of 100
      for (let i = 0; i < trackUris.length; i += maxTracksPerRequest) {
        const batch = trackUris.slice(i, i + maxTracksPerRequest);
        
        const response = await axios.post(
          `${this.baseURL}/playlists/${playlistId}/tracks`,
          {
            uris: batch,
          },
          {
            headers: {
              Authorization: `Bearer ${userAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        results.push({
          snapshot_id: response.data.snapshot_id,
          tracks_added: batch.length,
        });
      }

      return {
        total_tracks_added: trackUris.length,
        batches: results,
      };
    } catch (error) {
      console.error(
        "Error adding tracks to Spotify playlist:",
        error.response?.data || error.message
      );
      throw new Error("Failed to add tracks to Spotify playlist");
    }
  }

  /**
   * Get user's playlists (to find existing playlist)
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @param {string} playlistName - Name of playlist to search for
   * @returns {Promise<Object|null>} Playlist object if found, null otherwise
   */
  async getUserPlaylistByName(userAccessToken, playlistName) {
    try {
      let offset = 0;
      const limit = 50;

      while (true) {
        const response = await axios.get(`${this.baseURL}/me/playlists`, {
          params: {
            limit: limit,
            offset: offset,
          },
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
          },
        });

        const playlists = response.data.items;
        
        // Search for playlist with matching name
        const found = playlists.find(
          (playlist) => playlist.name === playlistName
        );
        
        if (found) {
          return {
            id: found.id,
            name: found.name,
            description: found.description,
            external_urls: found.external_urls,
            public: found.public,
          };
        }

        // If no more playlists, stop searching
        if (playlists.length < limit) {
          break;
        }

        offset += limit;
      }

      return null;
    } catch (error) {
      console.error(
        "Error searching user playlists:",
        error.response?.data || error.message
      );
      throw new Error("Failed to search user playlists");
    }
  }

  /**
   * Add a track to the user's playback queue
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @param {string} trackUri - Spotify track URI (e.g., "spotify:track:4iV5W9uYEdYUVa79Axb7Rh")
   * @param {string} deviceId - Optional device ID (uses active device if not provided)
   * @returns {Promise<boolean>} True if added successfully
   */
  async addToQueue(userAccessToken, trackUri, deviceId = null) {
    try {
      const params = new URLSearchParams({ uri: trackUri });
      if (deviceId) {
        params.append("device_id", deviceId);
      }

      const response = await axios.post(
        `${this.baseURL}/me/player/queue?${params.toString()}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
          },
        }
      );

      // Success response is 204 No Content
      return response.status === 204;
    } catch (error) {
      // Handle specific error cases
      if (error.response?.status === 404) {
        // No active device
        throw new Error("No active Spotify device found. Please open Spotify and start playing music.");
      } else if (error.response?.status === 403) {
        // Premium required
        throw new Error("Spotify Premium is required to add songs to queue.");
      } else if (error.response?.status === 401) {
        // Invalid or expired token
        throw new Error("Spotify authentication failed. Please reconnect to Spotify.");
      }
      
      console.error(
        "Error adding track to Spotify queue:",
        error.response?.data || error.message
      );
      throw new Error("Failed to add track to Spotify queue");
    }
  }

  /**
   * Get user's available playback devices
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @returns {Promise<Array>} Array of available devices
   */
  async getPlaybackDevices(userAccessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/me/player/devices`, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      });

      return response.data.devices || [];
    } catch (error) {
      console.error(
        "Error getting playback devices:",
        error.response?.data || error.message
      );
      throw new Error("Failed to get playback devices");
    }
  }

  /**
   * Get user's current playback state
   * @param {string} userAccessToken - User's Spotify OAuth access token
   * @returns {Promise<Object|null>} Current playback state or null if nothing is playing
   */
  async getCurrentPlayback(userAccessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/me/player`, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 204) {
        // No content = nothing is playing
        return null;
      }
      
      const errorDetails = error.response?.data || error.message;
      const statusCode = error.response?.status;
      
      console.error(
        "Error getting current playback:",
        `Status: ${statusCode}`,
        `Error: ${JSON.stringify(errorDetails)}`
      );
      
      // Handle specific error cases
      if (statusCode === 403) {
        throw new Error("Spotify access denied. Please check your app permissions in Spotify Developer Dashboard.");
      } else if (statusCode === 401) {
        throw new Error("Spotify authentication failed. Please reconnect to Spotify.");
      } else if (statusCode === 404) {
        // No active device - this is normal, not an error
        return null;
      }
      
      throw new Error("Failed to get current playback");
    }
  }
}

// Export singleton instance
module.exports = new SpotifyService();
