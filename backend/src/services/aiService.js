const axios = require("axios");

class AIService {
  constructor() {
    // Digital Ocean AI Agent URL from environment variable or default
    this.baseURL = process.env.AI_AGENT_URL || "https://xxfge74gpome3iqfwpkch7jd.agents.do-ai.run";
    this.apiKey = process.env.AI_AGENT_API_KEY || null;
    this.timeout = parseInt(process.env.AI_AGENT_TIMEOUT || "30000");

    // Debug: Log initialization (don't log full API key)
    if (this.apiKey) {
      console.log(`[AI Service] Initialized with API key: ${this.apiKey.substring(0, 10)}...`);
    } else {
      console.warn(`[AI Service] ⚠️  Initialized WITHOUT API key - requests may fail!`);
    }

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[AI Service] ${config.method?.toUpperCase()} ${config.url}`);
        // Debug: Check if Authorization header is present (don't log the key)
        if (config.headers?.Authorization) {
          console.log(`[AI Service] Authorization header present (API key configured)`);
        } else {
          console.warn(`[AI Service] ⚠️  No Authorization header! API key: ${this.apiKey ? 'SET' : 'NOT SET'}`);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error("[AI Service Error]", error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send a message/prompt to the AI agent
   * @param {Object} data - The data to send to the AI agent
   * @param {string} data.message - Message to send
   * @param {string} data.prompt - Alternative prompt field
   * @param {Object} data - Any additional data
   * @returns {Promise<Object>} AI agent response
   */
  async sendMessage(data) {
    try {
      // Digital Ocean AI Agent uses /api/v1/chat/completions endpoint
      // It expects a messages array format (like OpenAI)
      let messages = [];
      
      // If messages array is provided, use it
      if (Array.isArray(data.messages)) {
        messages = data.messages;
      } else {
        // Otherwise, create a message from the message/prompt field
        const content = data.message || data.prompt;
        if (content) {
          messages = [
            {
              role: "user",
              content: content,
            },
          ];
        }
      }

      // Validate that messages array is not empty
      if (!messages || messages.length === 0) {
        throw new Error("Messages array cannot be empty. Provide either 'message', 'prompt', or 'messages' array with at least one message.");
      }

      // Validate message structure
      const hasValidMessages = messages.every(msg => 
        msg && 
        typeof msg === 'object' && 
        msg.role && 
        msg.content &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0
      );

      if (!hasValidMessages) {
        throw new Error("Each message must have 'role' and 'content' properties, and content must be a non-empty string.");
      }

      // Build request body with messages array
      const requestBody = {
        messages: messages,
      };

      // Add optional parameters if provided
      if (data.temperature !== undefined) requestBody.temperature = data.temperature;
      if (data.max_tokens !== undefined) requestBody.max_tokens = data.max_tokens;
      if (data.max_completion_tokens !== undefined) requestBody.max_completion_tokens = data.max_completion_tokens;
      if (data.stream !== undefined) requestBody.stream = data.stream;
      if (data.top_p !== undefined) requestBody.top_p = data.top_p;
      if (data.k !== undefined) requestBody.k = data.k;
      if (data.retrieval_method !== undefined) requestBody.retrieval_method = data.retrieval_method;
      if (data.frequency_penalty !== undefined) requestBody.frequency_penalty = data.frequency_penalty;
      if (data.presence_penalty !== undefined) requestBody.presence_penalty = data.presence_penalty;
      if (data.stop !== undefined) requestBody.stop = data.stop;
      if (data.instruction_override !== undefined) requestBody.instruction_override = data.instruction_override;

      const response = await this.client.post("/api/v1/chat/completions", requestBody, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      // If it's already our validation error, re-throw it
      if (error.message && (
          error.message.includes("Messages array cannot be empty") || 
          error.message.includes("Each message must have")
        )) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const message = errorData?.error || errorData?.message || error.message;
        
        // Provide more helpful error messages based on status code
        if (status === 401) {
          throw new Error("AI Agent authentication failed. Check your AI_AGENT_API_KEY.");
        } else if (status === 404) {
          throw new Error("AI Agent endpoint not found. Check your AI_AGENT_URL.");
        } else if (status === 429) {
          throw new Error("AI Agent rate limit exceeded. Please try again later.");
        } else if (status >= 500) {
          throw new Error(`AI Agent server error (${status}). The service may be temporarily unavailable.`);
        }
        
        throw new Error(`AI Agent request failed: ${status} - ${message}`);
      }
      throw error;
    }
  }

  /**
   * Generic method to call any endpoint on the AI agent
   * @param {string} endpoint - The endpoint path (e.g., '/generate', '/analyze')
   * @param {Object} data - The data to send
   * @param {string} method - HTTP method (default: 'POST')
   * @returns {Promise<Object>} Response data
   */
  async callAgent(endpoint, data = null, method = "POST") {
    try {
      const config = {
        method,
        url: endpoint.startsWith("/") ? endpoint : `/${endpoint}`,
        ...(data && { data }),
      };

      const response = await this.client(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const message = errorData?.error || errorData?.message || error.message;
        
        // Provide more helpful error messages based on status code
        if (status === 401) {
          throw new Error("AI Agent authentication failed. Check your AI_AGENT_API_KEY.");
        } else if (status === 404) {
          throw new Error(`AI Agent endpoint not found: ${endpoint}. Check your AI_AGENT_URL.`);
        } else if (status === 429) {
          throw new Error("AI Agent rate limit exceeded. Please try again later.");
        } else if (status >= 500) {
          throw new Error(`AI Agent server error (${status}). The service may be temporarily unavailable.`);
        }
        
        throw new Error(`AI Agent request failed: ${status} - ${message}`);
      }
      throw error;
    }
  }

  /**
   * Health check for AI agent connection
   * @returns {Promise<Object>} Health check response
   */
  async healthCheck() {
    try {
      // Use the dedicated health check endpoint
      const response = await this.client.get("/health", { timeout: 5000 });
      return { connected: true, status: response.status, data: response.data };
    } catch (error) {
      // If /health fails, check if root is accessible (returns docs)
      try {
        const response = await this.client.get("/", { timeout: 5000 });
        return { 
          connected: true, 
          status: response.status, 
          message: "AI agent is reachable (returned docs page)" 
        };
      } catch (getError) {
        return {
          connected: false,
          error: getError.message || "AI agent is not reachable",
        };
      }
    }
  }
}

// Export singleton instance
module.exports = new AIService();

