const aiService = require("../services/aiService");

/**
 * Handle AI chat/message requests
 */
const sendMessage = async (req, res) => {
  try {
    const { message, prompt, ...otherData } = req.body;

    if (!message && !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Either "message" or "prompt" is required in the request body',
      });
    }

    const response = await aiService.sendMessage({
      message,
      prompt,
      ...otherData,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error sending message to AI agent:", error);
    res.status(500).json({
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

    const response = await aiService.callAgent(endpoint, data, method);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error calling AI agent endpoint:", error);
    res.status(500).json({
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

