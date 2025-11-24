// Admin messages
const adminMessages = {
  adminAccessRequired: "Admin access required",
  errorFetchingEndpointStats: "Error fetching endpoint statistics",
  errorFetchingUserConsumptionStats: "Error fetching user consumption statistics",
  errorFetchingApiLogs: "Error fetching API call logs",
  userIdRequired: "User ID is required",
  userNotFound: "User not found",
  apiCallCountReset: (userId) => `API call count reset for user ${userId}`,
  errorResettingApiCallCount: "Error resetting user API call count",
};

module.exports = adminMessages;

