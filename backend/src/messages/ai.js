// AI service messages
const aiMessages = {
  messagePromptOrMessagesRequired: 'Either "message", "prompt", or "messages" array is required in the request body',
  failedToCommunicateWithAiAgent: "Failed to communicate with AI agent",
  aiAgentNotReachable: "AI agent is not reachable",
  aiAgentReachable: "AI agent is reachable (returned docs page)",
  messagesArrayCannotBeEmpty: "Messages array cannot be empty. Provide either 'message', 'prompt', or 'messages' array with at least one message.",
  invalidMessageStructure: "Each message must have 'role' and 'content' properties, and content must be a non-empty string.",
  aiAgentAuthenticationFailed: "AI Agent authentication failed. Check your AI_AGENT_API_KEY.",
  aiAgentEndpointNotFound: "AI Agent endpoint not found. Check your AI_AGENT_URL.",
  aiAgentRateLimitExceeded: "AI Agent rate limit exceeded. Please try again later.",
  aiAgentServerError: (status) => `AI Agent server error (${status}). The service may be temporarily unavailable.`,
  aiAgentRequestFailed: (status, message) => `AI Agent request failed: ${status} - ${message}`,
};

module.exports = aiMessages;

