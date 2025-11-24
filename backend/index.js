require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./src/utils/db");

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
const {
  apiTrackingMiddleware,
} = require("./src/middleware/apiTrackingMiddleware");

// Swagger documentation
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");

// Middleware
// CORS configuration - must explicitly allow origins when credentials are included
const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://dj-clownfish-ui-da6vv.ondigitalocean.app",
  "https://dj-clownfish-frontend-st7pu.ondigitalocean.app",
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove any undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // When credentials are included, we MUST return a specific origin, never '*'
      // Requests without origin are typically from non-browser clients (Postman, curl, etc.)
      if (!origin) {
        // For non-browser requests, return a default origin (not true!)
        return callback(
          null,
          "https://dj-clownfish-frontend-st7pu.ondigitalocean.app"
        );
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        // IMPORTANT: Return the origin string, not true, when credentials are included
        callback(null, origin);
      } else {
        // For development, allow any localhost origin
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          // Return the actual origin string
          callback(null, origin);
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
  if (req.path === "/health" || req.path === "/") {
    return next();
  }
  apiTrackingMiddleware(req, res, next);
});

// Routes
/**
 * @swagger
 * /:
 *   get:
 *     summary: Server status endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Server is running!
 */
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-01T00:00:00.000Z
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Versioning - All routes under /api/v1
// Authentication routes
app.use("/api/v1/auth", authRoutes);

// AI Agent routes
app.use("/api/v1/ai", aiRoutes);

// Voting routes
app.use("/api/v1/voting", votingRoutes);

// Spotify routes
app.use("/api/v1/spotify", spotifyRoutes);

// Admin routes (for API statistics and user management)
app.use("/api/v1/admin", adminRoutes);

// Jukebox routes (for automated playlist management)
app.use("/api/v1/jukebox", jukeboxRoutes);

// Swagger API Documentation
app.use(
  "/doc",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "DJ Clownfish API Documentation",
  })
);

// Start server
app.listen(PORT, async () => {
  // Test database connection
  await db.testConnection();

  console.log(`\n🚀 Server is running on port ${PORT}\n`);
  console.log("📋 Available Endpoints:\n");

  console.log("🔐 Authentication (/api/v1/auth):");
  console.log(
    "   POST   /api/v1/auth/signup          - Register new user (public)"
  );
  console.log("   POST   /api/v1/auth/login           - Login user (public)");
  console.log(
    "   GET    /api/v1/auth/profile         - Get user profile (protected)"
  );
  console.log(
    "   GET    /api/v1/auth/users            - Get all users (protected)"
  );

  console.log("\n🤖 AI Agent (/api/v1/ai):");
  console.log(
    "   GET    /api/v1/ai/health            - Check AI agent health (public)"
  );
  console.log(
    "   POST   /api/v1/ai/chat              - Send message to AI (API key)"
  );
  console.log(
    "   POST   /api/v1/ai/call              - Call AI agent endpoint (API key)"
  );

  console.log("\n🗳️  Voting (/api/v1/voting):");
  console.log(
    "   POST   /api/v1/voting/rounds                    - Create round (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/rounds                     - Get my rounds (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/rounds/:roundId            - Get round details (public)"
  );
  console.log(
    "   POST   /api/v1/voting/rounds/:roundId/vote       - Submit vote (public)"
  );
  console.log(
    "   GET    /api/v1/voting/rounds/:roundId/results    - Get results (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/rounds/:roundId/public-results - Get public results (public)"
  );
  console.log(
    "   POST   /api/v1/voting/rounds/:roundId/next-round - Generate next round (protected)"
  );
  console.log(
    "   PATCH  /api/v1/voting/rounds/:roundId/status    - Update round status (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/rounds/:roundId/qr        - Get QR code (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/spotify/search             - Search Spotify (protected)"
  );
  console.log(
    "   GET    /api/v1/voting/spotify/tracks/:trackId    - Get Spotify track (public)"
  );

  console.log("\n🎵 Spotify (/api/v1/spotify):");
  console.log("   GET    /api/v1/spotify/search                    - Search Spotify tracks (public)");
  console.log("   GET    /api/v1/spotify/tracks/:trackId           - Get Spotify track (public)");
  console.log("   GET    /api/v1/spotify/oauth/authorize           - Initiate OAuth (protected)");
  console.log("   GET    /api/v1/spotify/oauth/callback            - OAuth callback (public)");
  console.log("   GET    /api/v1/spotify/me/token                  - Get user's Spotify token (protected)");
  console.log("   POST   /api/v1/spotify/me/queue                  - Add track to queue (protected)");
  
  console.log("\n👑 Admin (/api/v1/admin):");
  console.log(
    "   GET    /api/v1/admin/stats/endpoints             - Get endpoint stats (admin)"
  );
  console.log(
    "   GET    /api/v1/admin/stats/users                 - Get user consumption (admin)"
  );
  console.log(
    "   GET    /api/v1/admin/stats/logs                  - Get API call logs (admin)"
  );
  console.log(
    "   POST   /api/v1/admin/users/:userId/reset-api-count - Reset user API count (admin)"
  );

  console.log("\n🎧 Jukebox (/api/v1/jukebox):");
  console.log("   POST   /api/v1/jukebox/start                     - Start jukebox mode (protected)");
  console.log("   GET    /api/v1/jukebox/status                    - Get jukebox status (protected)");
  console.log("   POST   /api/v1/jukebox/stop                      - Stop jukebox (protected)");
  console.log("   POST   /api/v1/jukebox/skip                      - Skip current song (protected)");
  console.log("   POST   /api/v1/jukebox/pause                     - Pause jukebox (protected)");
  console.log("   POST   /api/v1/jukebox/resume                    - Resume jukebox (protected)");
  console.log("   GET    /api/v1/jukebox/owners/:ownerId/voting-round - Get voting round (public)");
  console.log("   GET    /api/v1/jukebox/owners/:ownerId/now-playing  - Get now playing (public)");
  
  console.log("\n🏥 Health:");
  console.log("   GET    /health                  - Health check (public)");
  console.log("   GET    /                        - Server status (public)");

  console.log(`\n✅ API Tracking: Enabled (Unlimited calls per user)\n`);
});

module.exports = app;
