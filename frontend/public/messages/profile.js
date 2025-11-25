// Profile page messages
export const profileMessages = {
  unableToLoadUserInfo: 'Unable to load user information.',
  noApiConsumptionData: 'No API consumption data available.',
  failedToLoadProfile: 'Failed to load profile: ',
  failedToLoadUserInfo: 'Failed to load user information. Please try logging in again.',
  unknownError: 'Unknown error',
  
  // API Consumption
  apiLimitExceeded: 'API Limit Exceeded:',
  apiLimitExceededMessage: (limit) => `You have used all ${limit} free API calls. Services will continue, but please be aware of your usage.`,
  warningRemaining: (remaining) => `Warning: You have ${remaining} free API call${remaining === 1 ? '' : 's'} remaining.`,
  freeApiCalls: (used, limit) => `Free API Calls: ${used} / ${limit} used`,
  remainingCalls: (remaining) => `(${remaining} remaining)`,
  limitExceeded: '(Limit exceeded)',
  noEndpointData: 'No endpoint-specific data available yet. Start making API calls to see your usage breakdown.',
  
  // Endpoint Breakdown Note
  breakdownNoteLabel: 'Note:',
  breakdownNoteMessage: (recentCalls, totalCalls) => `Endpoint breakdown shows ${recentCalls.toLocaleString()} recent calls. Your total of ${totalCalls.toLocaleString()} calls includes all API usage since account creation. Endpoint details reset when the server restarts.`,
  emptyStateMessage: (totalCalls) => `Your total of ${totalCalls.toLocaleString()} API calls is tracked in the database, but endpoint details are only available for recent calls.`,
  
  // Table Headers
  tableHeaderMethod: 'Method',
  tableHeaderEndpoint: 'Endpoint',
  tableHeaderRequests: 'Requests',
  
  // Common Labels
  notAvailable: 'N/A',
};

