# Quick Start Guide

## Prerequisites Checklist

- [ ] Node.js installed (v14+)
- [ ] Spotify Developer Account (get credentials from https://developer.spotify.com)
- [ ] Digital Ocean AI Agent API key
- [ ] npm or yarn installed

## 5-Minute Setup

### 1. Backend Setup (2 minutes)

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_change_this
AI_AGENT_API_KEY=your_ai_agent_key
AI_AGENT_URL=https://api.digitalocean.com/v2/ai/agents
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
FRONTEND_URL=http://localhost:8080
```

Start backend:
```bash
npm start
```

### 2. Frontend Setup (1 minute)

Update backend URL in all HTML files:
- `frontend/public/index.html`
- `frontend/public/login.html`
- `frontend/public/signup.html`
- `frontend/public/dashboard.html`
- `frontend/public/vote.html`

Change this line in each file:
```javascript
window.BACKEND_URL = 'http://localhost:3000'; // Change to your backend URL
```

### 3. Start Frontend (1 minute)

```bash
cd frontend
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js http-server
npx http-server public -p 8080

# Option 3: Docker (if configured)
docker build -t frontend .
docker run -p 8080:80 frontend
```

### 4. Test the Application (1 minute)

1. Open browser: `http://localhost:8080`
2. Sign up for an account
3. Login to dashboard
4. Create a voting round
5. Click "Show QR Code" to get the voting link
6. Open the voting link in another browser/incognito window
7. Vote on a song

## Common Issues

### Backend won't start
- Check if PORT 3000 is already in use
- Verify all environment variables are set in `.env`
- Check `npm install` completed successfully

### Frontend can't connect to backend
- Verify backend is running on correct port
- Check `BACKEND_URL` in HTML files matches backend URL
- Check CORS settings in backend (should allow `FRONTEND_URL`)

### Spotify integration not working
- Verify Spotify credentials in `.env`
- Check Spotify app settings allow the redirect URLs
- Ensure Spotify Web API is enabled in developer dashboard

### AI agent not generating songs
- Verify `AI_AGENT_API_KEY` is correct
- Check API quota/limits
- Check backend logs for error messages

## Production Deployment

### Backend
- Use environment variables for all secrets
- Set up process manager (PM2, systemd)
- Configure HTTPS with SSL certificate
- Set up proper logging

### Frontend
- Build and serve with Nginx
- Configure proper caching headers
- Set up SSL/HTTPS
- Update `BACKEND_URL` to production backend URL

## Testing Checklist

- [ ] Can sign up new user
- [ ] Can login with credentials
- [ ] Can create voting round
- [ ] QR code generates correctly
- [ ] Can vote on songs (public page)
- [ ] Results update in real-time
- [ ] Can pause/resume rounds
- [ ] Can generate next round
- [ ] Spotify player shows for winners
- [ ] Round status prevents voting when paused
