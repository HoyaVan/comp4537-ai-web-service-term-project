# Admin User Setup Guide

This guide explains how to become an admin user when hosting the frontend and backend servers in production.

## Methods to Become Admin

### Method 1: Environment Variable Bootstrap (Recommended for Production)

The easiest way to ensure you have an admin user when deploying is to use environment variables. The server will automatically create an admin user on startup.

**Add these to your `.env` file or hosting platform environment variables:**

```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Your Name
```

When the server starts, it will:
- Create the admin user if it doesn't exist
- Update existing user to admin if the email already exists

**Note:** Make sure to use a strong password and keep these credentials secure!

### Method 2: Configure Admin Emails via Environment Variable

You can specify which emails should automatically become admin during signup:

```env
ADMIN_EMAILS=admin@example.com,your-email@example.com,another-admin@example.com
```

When users sign up with any of these emails, they will automatically be assigned the `admin` role.

**Default:** If `ADMIN_EMAILS` is not set, only `admin@admin.com` will be admin.

### Method 3: Sign Up with Admin Email

If you've configured `ADMIN_EMAILS` in your environment variables, simply sign up with one of those emails. You'll automatically be an admin.

**Example:**
- If `ADMIN_EMAILS=admin@example.com,your-email@example.com`
- Sign up with `admin@example.com` or `your-email@example.com`
- You'll be an admin automatically

### Method 4: Use the API Endpoint (After Authentication)

If you're already logged in as a regular user, you can make yourself admin using the API:

**Endpoint:** `PATCH /api/auth/profile/role`

**Request:**
```bash
curl -X PATCH http://your-backend-url/api/auth/profile/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"role": "admin"}'
```

**Using JavaScript (Browser Console):**
```javascript
const token = localStorage.getItem('token') || sessionStorage.getItem('token');
fetch('http://your-backend-url/api/auth/profile/role', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ role: 'admin' })
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
  location.reload();
});
```

### Method 5: Admin Updates Another User (Requires Admin Access)

If you already have admin access, you can update any user's role:

**Endpoint:** `PATCH /api/admin/users/:userId/role`

**Request:**
```bash
curl -X PATCH http://your-backend-url/api/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{"role": "admin"}'
```

## Production Deployment Checklist

1. **Set Environment Variables:**
   ```env
   ADMIN_EMAIL=your-production-email@example.com
   ADMIN_PASSWORD=strong-secure-password
   ADMIN_EMAILS=your-production-email@example.com
   ```

2. **Deploy Backend:**
   - The server will automatically create the admin user on first startup

3. **Verify Admin Access:**
   - Log in with your admin email
   - Check that you can access `/admin.html` without errors
   - Verify you can see API statistics

4. **Security Notes:**
   - Never commit `.env` files to version control
   - Use strong passwords for admin accounts
   - Consider using a password manager
   - Rotate admin passwords regularly

## Troubleshooting

### "Admin access required" error

If you're getting this error:
1. Check that your user has `role: "admin"` in the user object
2. Verify you're using the correct JWT token
3. Try logging out and logging back in to refresh your token
4. Use Method 1 or Method 4 to ensure you have admin access

### Admin user not created on startup

1. Check that `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in environment variables
2. Check server logs for bootstrap errors
3. Verify the email format is correct
4. Ensure the server has write permissions (for in-memory storage, this shouldn't be an issue)

### User exists but not admin

If a user with the admin email already exists but isn't admin:
1. The bootstrap script will automatically update them to admin
2. Or use Method 4 to update your own role
3. Or have another admin use Method 5 to update your role

## Example .env Configuration

```env
# Server Configuration
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=https://your-frontend-url.com

# Admin Bootstrap (creates admin on server start)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=ChangeThisToSecurePassword123!
ADMIN_NAME=Admin User

# Admin Emails (users with these emails become admin on signup)
ADMIN_EMAILS=admin@yourdomain.com,owner@yourdomain.com

# AI Agent Configuration
AI_AGENT_API_KEY=your-ai-agent-api-key
AI_AGENT_URL=https://api.digitalocean.com/v2/ai/agents

# Spotify Configuration
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

