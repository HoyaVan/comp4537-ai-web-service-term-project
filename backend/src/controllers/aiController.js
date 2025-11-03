const aiService = require("../services/aiService");

/**
 * Handle AI chat/message requests
 */
const sendMessage = async (req, res) => {
  try {
    const { message, prompt, messages, ...otherData } = req.body;

    // Validate input: need either message, prompt, or messages array
    if (!message && !prompt && !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Either "message", "prompt", or "messages" array is required in the request body',
      });
    }

    const response = await aiService.sendMessage({
      message,
      prompt,
      messages,
      ...otherData,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error sending message to AI agent:", error);
    
    // Return 400 for validation errors, 500 for server errors
    const isValidationError = error.message && (
      error.message.includes("Messages array cannot be empty") ||
      error.message.includes("Each message must have")
    );
    
    const statusCode = isValidationError ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to communicate with AI agent",
    });
  }
};

/**
 * Generic endpoint to call any AI agent endpoint
 */
const callAgentEndpoint = async (req, res) => {
  try {
    const { endpoint, method = "POST", data } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint is required in the request body',
      });
    }

    // Validate HTTP method
    const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    if (!validMethods.includes(method.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid HTTP method. Must be one of: ${validMethods.join(", ")}`,
      });
    }

    const response = await aiService.callAgent(endpoint, data, method.toUpperCase());

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error calling AI agent endpoint:", error);
    
    // Return 400 for client errors (4xx), 500 for server errors
    const isClientError = error.message && (
      error.message.includes("authentication failed") ||
      error.message.includes("endpoint not found")
    );
    
    const statusCode = isClientError ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to communicate with AI agent",
    });
  }
};

/**
 * Health check for AI agent connection
 */
const checkAIAgentHealth = async (req, res) => {
  try {
    const healthStatus = await aiService.healthCheck();

    if (healthStatus.connected) {
      res.json({
        success: true,
        connected: true,
        ...healthStatus,
      });
    } else {
      res.status(503).json({
        success: false,
        connected: false,
        ...healthStatus,
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      connected: false,
      error: error.message || "AI agent is not reachable",
    });
  }
};

module.exports = {
  sendMessage,
  callAgentEndpoint,
  checkAIAgentHealth,
};

