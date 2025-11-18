# Setup Checklist for AI-DJ-Voting App

## ✅ What's Already Working

- ✅ Backend code structure is complete
- ✅ Frontend HTML/CSS/JS files are present
- ✅ All routes, controllers, and services are implemented
- ✅ Dockerfiles are configured
- ✅ Dependencies are listed in package.json

## ⚠️ Required Setup Steps

### 1. Backend Environment Variables

Create `backend/.env` file with the following variables:

```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
AI_AGENT_API_KEY=your_digital_ocean_ai_agent_api_key
AI_AGENT_URL=https://xxfge74gpome3iqfwpkch7jd.agents.do-ai.run
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
FRONTEND_URL=http://localhost:8080
```

**Required Credentials:**
- **JWT_SECRET**: Any random string (use a strong secret in production)
- **AI_AGENT_API_KEY**: Get from Digital Ocean AI Agent dashboard
- **AI_AGENT_URL**: Your Digital Ocean AI Agent endpoint URL
- **SPOTIFY_CLIENT_ID** & **SPOTIFY_CLIENT_SECRET**: Get from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Frontend Configuration

The frontend is already configured to use:
- `https://dj-clownfish-uxa88.ondigitalocean.app` as the backend URL

**For local development**, update `BACKEND_URL` in these files:
- `frontend/public/index.html`
- `frontend/public/login.html`
- `frontend/public/signup.html`
- `frontend/public/dashboard.html`
- `frontend/public/vote.html`

Change from:
```javascript
window.BACKEND_URL = 'https://dj-clownfish-uxa88.ondigitalocean.app';
```

To:
```javascript
window.BACKEND_URL = 'http://localhost:3000';
```

### 4. Start the Application

**Backend:**
```bash
cd backend
npm start
# Or for development with auto-reload:
npm run dev
```

**Frontend:**
```bash
cd frontend
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js http-server
npx http-server public -p 8080

# Option 3: Docker
docker build -t frontend .
docker run -p 8080:80 frontend
```

### 5. Test the Application

1. Open `http://localhost:8080`
2. Sign up for an account
3. Login to dashboard
4. Create a voting round
5. Click "Show QR Code" to get the voting link
6. Open the voting link in another browser/incognito window
7. Vote on a song

## 🔍 Potential Issues to Check

### Backend Issues

1. **Missing .env file**: Backend won't start properly without environment variables
2. **Port conflicts**: Make sure port 3000 is available
3. **AI Agent connection**: Check if `AI_AGENT_API_KEY` and `AI_AGENT_URL` are correct
4. **Spotify credentials**: Verify Spotify API credentials are valid

### Frontend Issues

1. **CORS errors**: Backend CORS is set to `origin: true`, should work but verify
2. **Backend URL mismatch**: Make sure `BACKEND_URL` in HTML files matches actual backend URL
3. **Missing dependencies**: Frontend uses CDN for QR code library, should work offline

### Code Issues Found

1. **TypeScript files**: There are `.ts` files in `src/controllers/`, `src/services/`, and `src/utils/` directories, but the project uses JavaScript. These might be leftover files:
   - `backend/src/controllers/index.ts`
   - `backend/src/services/index.ts`
   - `backend/src/utils/index.ts`

2. **AI Agent URL**: The default URL in `aiService.js` is hardcoded to `https://xxfge74gpome3iqfwpkch7jd.agents.do-ai.run`. Make sure this matches your actual Digital Ocean AI Agent URL or set it via `AI_AGENT_URL` environment variable.

## 📝 Quick Start Commands

```bash
# 1. Setup backend
cd backend
npm install
# Create .env file (see above)
npm start

# 2. Setup frontend (in new terminal)
cd frontend
python -m http.server 8080
# Or: npx http-server public -p 8080

# 3. Open browser
open http://localhost:8080
```

## 🐳 Docker Deployment

**Backend:**
```bash
cd backend
docker build -t dj-clownfish-backend .
docker run -p 3000:3000 --env-file .env dj-clownfish-backend
```

**Frontend:**
```bash
cd frontend
docker build -t dj-clownfish-frontend .
docker run -p 8080:80 dj-clownfish-frontend
```

## ✅ Verification Checklist

- [ ] Backend `.env` file created with all required variables
- [ ] Backend dependencies installed (`npm install` in backend/)
- [ ] Backend starts without errors (`npm start`)
- [ ] Frontend `BACKEND_URL` matches backend URL
- [ ] Frontend serves correctly on port 8080
- [ ] Can access `http://localhost:8080` in browser
- [ ] Can sign up new user
- [ ] Can login with credentials
- [ ] Can create voting round
- [ ] AI generates 10 songs (check backend logs)
- [ ] QR code generates correctly
- [ ] Can vote on songs from voting page
- [ ] Results update in real-time

## 🚨 Critical Missing Items

1. **`.env` file** - Must be created in `backend/` directory
2. **API Credentials** - Need Spotify and Digital Ocean AI Agent credentials
3. **Local Development URLs** - Update `BACKEND_URL` in frontend HTML files for local dev

## 📚 Additional Notes

- The app uses **in-memory storage** - data is lost on server restart
- No database required for basic functionality
- All authentication is JWT-based
- QR codes are generated client-side using qrcode.js CDN
- Spotify integration uses OAuth Client Credentials flow (no user login required)

