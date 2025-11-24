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
};

