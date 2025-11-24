// Admin page messages
export const adminMessages = {
  failedToFetchUsers: 'Failed to fetch users',
  failedToLoadUsers: 'Failed to load users. Please try again.',
  accessDenied: 'Access denied. Admin privileges required.',
  loadingEndpointStats: 'Loading endpoint statistics...',
  failedToLoadEndpointStats: 'Failed to load endpoint statistics: ',
  errorLoadingEndpointStats: 'Error loading endpoint statistics: ',
  noEndpointStats: 'No endpoint statistics available.',
  loadingConsumptionStats: 'Loading consumption statistics...',
  failedToLoadConsumptionStats: 'Failed to load consumption statistics: ',
  errorLoadingConsumptionStats: 'Error loading consumption statistics: ',
  noConsumptionStats: 'No consumption statistics available.',
  unknownError: 'Unknown error',
  userCount: (count) => `${count} user${count !== 1 ? 's' : ''}`,
};

