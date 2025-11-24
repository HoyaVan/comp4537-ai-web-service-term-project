require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require("./src/routes/authRoutes");
const aiRoutes = require("./src/routes/aiRoutes");
const votingRoutes = require("./src/routes/votingRoutes");

const spotifyRoutes = require("./src/routes/spotifyRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const jukeboxRoutes = require("./src/routes/jukeboxRoutes");

// Import middleware
const { apiTrackingMiddleware } = require("./src/middleware/apiTrackingMiddleware");

// Middleware
// CORS configuration - must explicitly allow origins when credentials are included
const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://dj-clownfish-ui-da6vv.ondigitalocean.app",
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove any undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // For development, allow any localhost origin
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Tracking Middleware - Track all API calls
// Apply to all routes except health check
app.use((req, res, next) => {
  // Skip tracking for health check and root endpoint
  if (req.path === '/health' || req.path === '/') {
    return next();
  }
  apiTrackingMiddleware(req, res, next);
});

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// AI Agent routes
app.use("/api/ai", aiRoutes);

// Voting routes
app.use("/api/voting", votingRoutes);

// Spotify routes
app.use("/api/spotify", spotifyRoutes);

// Admin routes (for API statistics and user management)
app.use("/api/admin", adminRoutes);

// Jukebox routes (for automated playlist management)
app.use("/api/jukebox", jukeboxRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on port ${PORT}\n`);
  console.log("📋 Available Endpoints:\n");
  
  console.log("🔐 Authentication (/api/auth):");
  console.log("   POST   /api/auth/signup          - Register new user (public)");
  console.log("   POST   /api/auth/login           - Login user (public)");
  console.log("   GET    /api/auth/profile         - Get user profile (protected)");
  console.log("   GET    /api/auth/users            - Get all users (protected)");
  
  console.log("\n🤖 AI Agent (/api/ai):");
  console.log("   GET    /api/ai/health            - Check AI agent health (public)");
  console.log("   POST   /api/ai/chat              - Send message to AI (API key)");
  console.log("   POST   /api/ai/call              - Call AI agent endpoint (API key)");
  
  console.log("\n🗳️  Voting (/api/voting):");
  console.log("   POST   /api/voting/rounds                    - Create round (protected)");
  console.log("   GET    /api/voting/rounds                     - Get my rounds (protected)");
  console.log("   GET    /api/voting/rounds/:roundId            - Get round details (public)");
  console.log("   POST   /api/voting/rounds/:roundId/vote       - Submit vote (public)");
  console.log("   GET    /api/voting/rounds/:roundId/results    - Get results (protected)");
  console.log("   GET    /api/voting/rounds/:roundId/public-results - Get public results (public)");
  console.log("   POST   /api/voting/rounds/:roundId/next-round - Generate next round (protected)");
  console.log("   PATCH  /api/voting/rounds/:roundId/status    - Update round status (protected)");
  console.log("   GET    /api/voting/rounds/:roundId/qr        - Get QR code (protected)");
  console.log("   GET    /api/voting/spotify/search             - Search Spotify (protected)");
  console.log("   GET    /api/voting/spotify/tracks/:trackId    - Get Spotify track (public)");
  
  console.log("\n🎵 Spotify (/api/spotify):");
  console.log("   GET    /api/spotify/search                    - Search Spotify tracks (public)");
  console.log("   GET    /api/spotify/tracks/:trackId           - Get Spotify track (public)");
  console.log("   GET    /api/spotify/auth                      - Initiate OAuth (public)");
  console.log("   GET    /api/spotify/callback                 - OAuth callback (public)");
  
  console.log("\n👑 Admin (/api/admin):");
  console.log("   GET    /api/admin/stats/endpoints             - Get endpoint stats (admin)");
  console.log("   GET    /api/admin/stats/users                 - Get user consumption (admin)");
  console.log("   GET    /api/admin/stats/logs                  - Get API call logs (admin)");
  console.log("   POST   /api/admin/users/:userId/reset-api-count - Reset user API count (admin)");
  
  console.log("\n🎧 Jukebox (/api/jukebox):");
  console.log("   POST   /api/jukebox/start                     - Start jukebox mode (protected)");
  console.log("   GET    /api/jukebox/status                    - Get jukebox status (protected)");
  console.log("   POST   /api/jukebox/stop                      - Stop jukebox (protected)");
  console.log("   POST   /api/jukebox/skip                      - Skip current song (protected)");
  console.log("   POST   /api/jukebox/pause                     - Pause jukebox (protected)");
  console.log("   POST   /api/jukebox/resume                    - Resume jukebox (protected)");
  console.log("   GET    /api/jukebox/:ownerId/voting-round     - Get voting round (public)");
  console.log("   GET    /api/jukebox/:ownerId/now-playing      - Get now playing (public)");
  
  console.log("\n🏥 Health:");
  console.log("   GET    /health                  - Health check (public)");
  console.log("   GET    /                        - Server status (public)");
  
  console.log(`\n✅ API Tracking: Enabled (Unlimited calls per user)\n`);
});

module.exports = app;
