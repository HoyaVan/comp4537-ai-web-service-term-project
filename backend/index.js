require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require("./src/routes/authRoutes");
const aiRoutes = require("./src/routes/aiRoutes");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Auth endpoints available at http://localhost:${PORT}/api/auth`);
  console.log(`AI endpoints available at http://localhost:${PORT}/api/ai`);
});

module.exports = app;
