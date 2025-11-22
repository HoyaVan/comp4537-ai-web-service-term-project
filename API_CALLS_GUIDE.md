# How to Check API Calls - Complete Guide

This guide explains various methods to check and monitor API calls in your application.

## 1. Browser DevTools (Frontend - Client Side)

### Chrome/Edge/Firefox DevTools
1. **Open DevTools**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. **Go to Network Tab**: Click on the "Network" tab
3. **Filter by XHR/Fetch**: Click the filter icon and select "XHR" or "Fetch" to see only API calls
4. **Monitor Requests**: 
   - See all HTTP requests in real-time
   - Click on any request to see:
     - **Headers**: Request/Response headers, including Authorization tokens
     - **Payload**: Request body (for POST/PUT requests)
     - **Response**: Server response data
     - **Timing**: How long the request took
     - **Status Code**: HTTP status (200, 401, 404, etc.)

### What to Look For:
- **Request URL**: Which endpoint is being called
- **Method**: GET, POST, PUT, DELETE, etc.
- **Status Code**: 
  - `200` = Success
  - `400` = Bad Request (validation error)
  - `401` = Unauthorized (missing/invalid token)
  - `403` = Forbidden (no permission)
  - `404` = Not Found
  - `500` = Server Error
- **Response Time**: How long the request took
- **Request Headers**: Check if `Authorization: Bearer <token>` is included

### Example:
```
GET http://localhost:3000/api/auth/profile
Status: 200 OK
Time: 45ms
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 2. Server Console Logs (Backend - Server Side)

### View Server Logs
1. **Terminal/Console**: Check the terminal where your Node.js server is running
2. **Look for Log Messages**: Your server should log:
   - Incoming requests
   - API call tracking
   - Errors and warnings

### Enable Detailed Logging
The API tracking middleware will automatically log:
- Request method and endpoint
- User ID (if authenticated)
- Timestamp
- Response status

Example log output:
```
[API Tracker] POST /api/auth/login - User: anonymous - Status: 200 - Time: 12ms
[API Tracker] GET /api/auth/profile - User: user123 - Status: 200 - Time: 5ms
[API Tracker] POST /api/voting/rounds - User: user123 - Status: 201 - Time: 234ms
```

## 3. Postman / Insomnia (API Testing Tools)

### Using Postman
1. **Download Postman**: https://www.postman.com/downloads/
2. **Create a Request**:
   - Method: Select GET, POST, PUT, DELETE
   - URL: Enter your API endpoint (e.g., `http://localhost:3000/api/auth/profile`)
   - Headers: Add `Authorization: Bearer <your-token>`
   - Body: For POST/PUT, add JSON body
3. **Send Request**: Click "Send"
4. **View Response**: See status code, response body, headers, timing

### Using Insomnia
Similar to Postman, but lighter weight. Download from: https://insomnia.rest/

### Benefits:
- Test APIs without frontend
- Share API collections with team
- Automate API testing
- See detailed request/response information

## 4. Browser Console (JavaScript)

### Check API Calls in Console
Open browser console (`F12` → Console tab) and add logging:

```javascript
// Intercept fetch calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('API Call:', args[0], args[1]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('API Response:', response.status, response.url);
      return response;
    });
};
```

### Check Network Tab Programmatically
```javascript
// View all network requests
performance.getEntriesByType('resource')
  .filter(entry => entry.name.includes('/api/'))
  .forEach(entry => {
    console.log(`${entry.name} - ${entry.duration}ms`);
  });
```

## 5. Server-Side API Tracking Middleware

### What It Does:
- Automatically tracks all API calls
- Records per-user API consumption (for 20 free calls limit)
- Records per-endpoint statistics (for admin dashboard)
- Logs requests to console
- Stores data in memory (move to database later)

### How It Works:
1. **Middleware Intercepts Requests**: Before reaching your controllers
2. **Extracts Information**: Method, endpoint, user ID, timestamp
3. **Tracks Usage**: Updates user API call count
4. **Logs Request**: Outputs to console
5. **Checks Limits**: Enforces 20 free API calls per user

### Accessing Tracked Data:
- **User API Consumption**: Available via `/api/auth/profile` endpoint
- **Admin Stats**: Available via admin dashboard endpoints
- **Server Logs**: Check console output

## 6. Database Queries (When Using Database)

Once you move to a database, you can query API call logs:

### Example SQL Queries:
```sql
-- Get API calls for a specific user
SELECT * FROM api_calls WHERE user_id = 'user123' ORDER BY created_at DESC;

-- Get API call count per endpoint
SELECT method, endpoint, COUNT(*) as count 
FROM api_calls 
GROUP BY method, endpoint;

-- Get user API consumption
SELECT user_id, COUNT(*) as total_calls 
FROM api_calls 
GROUP BY user_id;
```

## 7. Monitoring Tools (Production)

### For Production Deployment:
- **Application Performance Monitoring (APM)**: New Relic, Datadog, Sentry
- **Log Aggregation**: ELK Stack, Splunk, CloudWatch
- **API Gateways**: AWS API Gateway, Kong, Apigee (provide built-in analytics)

## Common Issues to Check

### 1. CORS Errors
- **Symptom**: `Access-Control-Allow-Origin` error in console
- **Check**: Network tab → Failed request → Headers tab
- **Fix**: Ensure backend CORS is configured correctly

### 2. Authentication Errors
- **Symptom**: `401 Unauthorized` or `403 Forbidden`
- **Check**: Network tab → Request Headers → Look for `Authorization` header
- **Fix**: Ensure token is being sent with requests

### 3. API Call Limit Reached
- **Symptom**: `429 Too Many Requests` or custom error message
- **Check**: User profile endpoint to see API call count
- **Fix**: Check if user has exceeded 20 free calls

### 4. Slow API Responses
- **Symptom**: Requests taking > 1 second
- **Check**: Network tab → Timing tab
- **Fix**: Check server logs, database queries, external API calls

## Quick Debugging Checklist

When debugging API issues:

1. ✅ **Check Browser Network Tab**: Is the request being sent?
2. ✅ **Check Request Headers**: Is Authorization token included?
3. ✅ **Check Request Body**: Is the data formatted correctly?
4. ✅ **Check Server Logs**: Is the request reaching the server?
5. ✅ **Check Response Status**: What HTTP status code is returned?
6. ✅ **Check Response Body**: What error message is returned?
7. ✅ **Check API Tracking**: Is the call being tracked correctly?

## Testing Your API Calls

### Test Authentication:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@john.com","password":"123"}'

# Get Profile (with token)
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test API Tracking:
1. Make several API calls
2. Check server console for tracking logs
3. Call `/api/auth/profile` to see your API consumption
4. Login as admin and check admin dashboard for endpoint stats

## Next Steps

1. **Implement API Tracking Middleware**: See `apiTrackingMiddleware.js`
2. **Add to Server**: Apply middleware to all routes
3. **Create Admin Endpoints**: For viewing API statistics
4. **Move to Database**: Store API call logs in database
5. **Add Rate Limiting**: Enforce 20 free calls per user

