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
  
  // User API Consumption Modal
  modalTitle: 'API Consumption:',
  modalUserLabel: 'User:',
  modalUserIdLabel: 'User ID:',
  modalRoleLabel: 'Role:',
  modalTotalCallsLabel: 'Total API Calls:',
  modalCallLimitLabel: 'Call Limit:',
  modalRemainingCallsLabel: 'Remaining Calls:',
  modalLimitExceededLabel: 'Limit Exceeded:',
  modalEndpointBreakdownTitle: 'Endpoint Breakdown',
  modalNoEndpointData: 'No endpoint data available',
  modalUnlimited: 'Unlimited',
  modalYes: 'Yes',
  modalNo: 'No',
  modalNotAvailable: 'N/A',
  modalFailedToLoad: 'Failed to load user API consumption:',
  modalErrorLoading: 'Error loading user API consumption:',
  viewDetailsButton: 'View Details',
  
  // Table Headers
  tableHeaderMethod: 'Method',
  tableHeaderEndpoint: 'Endpoint',
  tableHeaderRequests: 'Requests',
  tableHeaderTotalRequests: 'Total Requests',
  tableHeaderName: 'Name',
  tableHeaderEmail: 'Email',
  tableHeaderUserId: 'User ID',
  tableHeaderActions: 'Actions',
  tableHeaderLatestUser: 'Latest User',
  tableHeaderLastCallUserEmail: 'Last Call User Email',
  tableHeaderLastCallUserId: 'Last Call User ID',
  tableHeaderLatestTime: 'Latest Time',
  
  // Common Values
  unknown: 'Unknown',
  notAvailable: 'N/A',
};

