const axios = require("axios");

class SpotifyService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || null;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || null;
    this.baseURL = "https://api.spotify.com/v1";
    this.tokenURL = "https://accounts.spotify.com/api/token";
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Get access token using client credentials flow
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET");
    }

    try {
      const response = await axios.post(
        this.tokenURL,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiration to 55 minutes (tokens last 1 hour)
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000 - 5 * 60 * 1000;

      return this.accessToken;
    } catch (error) {
      console.error("Error getting Spotify access token:", error.response?.data || error.message);
      throw new Error("Failed to authenticate with Spotify");
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 10) {
    try {
      const token = await this.getAccessToken();

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
      console.error("Error searching Spotify tracks:", error.response?.data || error.message);
      throw new Error("Failed to search Spotify tracks");
    }
  }

  /**
   * Get track by ID
   */
  async getTrack(trackId) {
    try {
      const token = await this.getAccessToken();

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
      console.error("Error getting Spotify track:", error.response?.data || error.message);
      throw new Error("Failed to get Spotify track");
    }
  }

  /**
   * Get multiple tracks by IDs
   */
  async getTracks(trackIds) {
    try {
      const token = await this.getAccessToken();

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
      console.error("Error getting Spotify tracks:", error.response?.data || error.message);
      throw new Error("Failed to get Spotify tracks");
    }
  }
}

// Export singleton instance
module.exports = new SpotifyService();
