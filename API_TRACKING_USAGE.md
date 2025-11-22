# API Tracking System - Usage Guide

## Overview

The API tracking system automatically monitors all API calls in your application. It tracks:
- **Per-user API consumption** (for the 20 free calls limit)
- **Per-endpoint statistics** (for admin dashboard)
- **Detailed API call logs** (for debugging and monitoring)

## How It Works

### Automatic Tracking
All API calls are automatically tracked when they reach your server. The middleware:
1. Intercepts all requests (except `/health` and `/`)
2. Records method, endpoint, user ID, status code, and response time
3. Updates user API call counts
4. Updates endpoint statistics
5. Logs to console

### API Call Limits
- Each user gets **20 free API calls**
- After 20 calls, users receive a `429 Too Many Requests` error
- Admin users have **unlimited API calls**
- The limit only applies to authenticated users

## Checking API Calls

### 1. Browser DevTools (Recommended for Development)

**Steps:**
1. Open your browser DevTools (`F12`)
2. Go to the **Network** tab
3. Filter by **XHR** or **Fetch**
4. Make API calls from your frontend
5. Click on any request to see:
   - Request URL and method
   - Request headers (including Authorization token)
   - Request payload (for POST/PUT)
   - Response status code
   - Response data
   - Response time

**Example:**
```
GET http://localhost:3000/api/auth/profile
Status: 200 OK
Time: 45ms
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Server Console Logs

**Steps:**
1. Check the terminal where your Node.js server is running
2. Look for log messages like:
   ```
   [API Tracker] POST /api/auth/login - User: anonymous - Status: 200 - Time: 12ms
   [API Tracker] GET /api/auth/profile - User: user123 - Status: 200 - Time: 5ms
   ```

### 3. User Profile Endpoint

**Endpoint:** `GET /api/auth/profile`

**Response includes API consumption:**
```json
{
  "success": true,
  "data": {
    "id": "user123",
    "email": "john@john.com",
    "name": "John",
    "apiConsumption": {
      "callsUsed": 15,
      "callsLimit": 20,
      "callsRemaining": 5,
      "hasExceededLimit": false
    }
  }
}
```

### 4. Admin Dashboard Endpoints

**Note:** These endpoints require admin authentication.

#### Get Endpoint Statistics
**Endpoint:** `GET /api/admin/stats/endpoints`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "method": "GET",
      "endpoint": "/api/auth/profile",
      "requests": 145
    },
    {
      "method": "POST",
      "endpoint": "/api/voting/rounds",
      "requests": 79
    }
  ],
  "count": 2
}
```

#### Get User Consumption Statistics
**Endpoint:** `GET /api/admin/stats/users`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user123",
      "name": "John",
      "email": "john@john.com",
      "totalRequests": 143
    },
    {
      "userId": "user456",
      "name": "Tom",
      "email": "tom@tom.io",
      "totalRequests": 12
    }
  ],
  "count": 2
}
```

#### Get All API Call Logs
**Endpoint:** `GET /api/admin/stats/logs?limit=100`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log123",
      "method": "GET",
      "endpoint": "/api/auth/profile",
      "userId": "user123",
      "statusCode": 200,
      "responseTime": 45,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

#### Reset User API Count
**Endpoint:** `POST /api/admin/users/:userId/reset-api-count`

**Response:**
```json
{
  "success": true,
  "message": "API call count reset for user user123"
}
```

## Testing API Calls

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@john.com","password":"123"}'
```

**Get Profile (with token):**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Get Admin Stats (admin token required):**
```bash
curl -X GET http://localhost:3000/api/admin/stats/endpoints \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

### Using Postman/Insomnia

1. Create a new request
2. Set method (GET, POST, etc.)
3. Enter URL: `http://localhost:3000/api/auth/profile`
4. Go to **Headers** tab
5. Add: `Authorization: Bearer YOUR_TOKEN`
6. Click **Send**
7. View response in the response panel

## Common Issues

### Issue: "You have exceeded your free API call limit"
**Solution:** 
- User has made 20+ API calls
- Admin can reset the count: `POST /api/admin/users/:userId/reset-api-count`
- Or wait for limit reset (if implemented)

### Issue: "Admin access required"
**Solution:**
- Make sure you're logged in as admin (`admin@admin.com`)
- Check that your token includes admin role
- Verify the user has `role: 'admin'` in the database

### Issue: API calls not being tracked
**Solution:**
- Check server console for tracking logs
- Verify middleware is applied in `backend/index.js`
- Make sure you're not calling `/health` or `/` endpoints (these are excluded)

## Integration with Frontend

### Display API Consumption to User

Update your dashboard to show API consumption:

```javascript
// In your dashboard.js or similar
async function loadUserInfo() {
  const { ok, data } = await apiRequest('/api/auth/profile');
  if (ok && data.success) {
    const user = data.data;
    const consumption = user.apiConsumption;
    
    // Display to user
    document.getElementById('api-calls-used').textContent = consumption.callsUsed;
    document.getElementById('api-calls-remaining').textContent = consumption.callsRemaining;
    
    if (consumption.hasExceededLimit) {
      showWarning('You have exceeded your free API call limit!');
    }
  }
}
```

### Display Admin Stats

```javascript
// In your admin.js
async function loadAdminStats() {
  const { ok, data } = await apiRequest('/api/admin/stats/endpoints');
  if (ok && data.success) {
    const stats = data.data;
    // Display in table
    displayEndpointStats(stats);
  }
  
  const { ok: ok2, data: data2 } = await apiRequest('/api/admin/stats/users');
  if (ok2 && data2.success) {
    const users = data2.data;
    // Display in table
    displayUserStats(users);
  }
}
```

## Next Steps

1. **Test the tracking**: Make some API calls and check the logs
2. **Update frontend**: Display API consumption to users
3. **Update admin page**: Show endpoint and user statistics
4. **Move to database**: Replace in-memory storage with database (required for production)
5. **Add rate limiting**: Enforce the 20 call limit (middleware is ready)

## Notes

- **In-Memory Storage**: Currently uses in-memory storage. Data is lost on server restart.
- **Database Migration**: You'll need to move this to a database for production.
- **Admin Role**: Users with email `admin@admin.com` automatically get admin role on signup.
- **Free Calls**: Only successful API calls (status 200-299) count toward the limit.

