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
    this.callbackURI = process.env.SPOTIFY_CALLBACK_URI || null;
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
    if (this.accessToken && this.expiresIn) {
      const expiresAt = this.tokenExpiresAt || (Date.now() + this.expiresIn * 1000);
      if (Date.now() < expiresAt) {
        return this.accessToken;
      }
      // Token expired, try to refresh if we have refresh token
      if (this.refreshToken) {
        try {
          const refreshed = await this.refreshAccessToken(this.refreshToken);
          this.accessToken = refreshed.access_token;
          this.expiresIn = refreshed.expires_in;
          this.tokenExpiresAt = Date.now() + refreshed.expires_in * 1000;
          if (refreshed.refresh_token) {
            this.refreshToken = refreshed.refresh_token;
          }
          return this.accessToken;
        } catch (error) {
          console.error("Failed to refresh OAuth token, falling back to client credentials:", error.message);
          // Fall through to client credentials flow
        }
      }
    }

    // Fall back to client credentials flow
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
      console.error(
        "Error getting Spotify track:",
        error.response?.data || error.message
      );
      throw new Error(spotifyMessages.failedToGetSpotifyTrack);
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
   */
  getAuthorizationURL(
    state = null,
    scopes = ["user-read-private", "user-read-email"]
  ) {
    if (!this.clientId) {
      throw new Error(spotifyMessages.spotifyClientIdNotConfigured);
    }

    if (!this.callbackURI) {
      throw new Error(spotifyMessages.spotifyCallbackUriNotConfigured);
    }

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
}

// Export singleton instance
module.exports = new SpotifyService();
