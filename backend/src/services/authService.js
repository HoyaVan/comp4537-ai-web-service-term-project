const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authMessages = require("../messages/auth");
const db = require("../utils/db");

// JWT secret (in production, use environment variable)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Parse and validate user ID
 * @param {string|number} userId - User ID to parse
 * @returns {number|null} Parsed user ID or null if invalid
 */
function parseUserId(userId) {
  if (!userId) return null;
  const userIdInt = parseInt(userId, 10);
  return isNaN(userIdInt) ? null : userIdInt;
}

/**
 * Check if a user is an admin
 * @param {number} userIdInt - User ID (integer)
 * @returns {Promise<boolean>} True if user is admin
 */
async function isUserAdmin(userIdInt) {
  const adminRecords = await db.query(
    "SELECT admin_id FROM `admin` WHERE user_id = ?",
    [userIdInt]
  );
  return adminRecords.length > 0;
}

/**
 * Get user from database by ID
 * @param {number} userIdInt - User ID (integer)
 * @param {boolean} includePassword - Whether to include password in result
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserFromDbById(userIdInt, includePassword = false) {
  const fields = includePassword
    ? "user_id, email, password, name, creation_date, api_calls, spotify_access_token, spotify_refresh_token, spotify_token_expires_at"
    : "user_id, email, name, creation_date, api_calls, spotify_access_token, spotify_refresh_token, spotify_token_expires_at";
  
  const users = await db.query(
    `SELECT ${fields} FROM \`user\` WHERE user_id = ?`,
    [userIdInt]
  );
  
  return users.length > 0 ? users[0] : null;
}

/**
 * Get user from database by email
 * @param {string} email - User email
 * @param {boolean} includePassword - Whether to include password in result
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserFromDbByEmail(email, includePassword = false) {
  const fields = includePassword
    ? "user_id, email, password, name, creation_date, api_calls, spotify_access_token, spotify_refresh_token, spotify_token_expires_at"
    : "user_id, email, name, creation_date, api_calls, spotify_access_token, spotify_refresh_token, spotify_token_expires_at";
  
  const users = await db.query(
    `SELECT ${fields} FROM \`user\` WHERE email = ?`,
    [email.toLowerCase()]
  );
  
  return users.length > 0 ? users[0] : null;
}

/**
 * Build user object from database user record
 * @param {Object} dbUser - User record from database
 * @param {boolean} isAdmin - Whether user is an admin
 * @returns {Object} User object without password
 */
function buildUserObject(dbUser, isAdmin) {
  return {
    id: dbUser.user_id.toString(),
    email: dbUser.email,
    name: dbUser.name,
    role: isAdmin ? 'admin' : 'user',
    createdAt: dbUser.creation_date
      ? new Date(dbUser.creation_date).toISOString()
      : new Date().toISOString(),
    api_calls: dbUser.api_calls || 0,
  };
}

/**
 * Hash a password
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Sign up a new user
 */
async function signup(email, password, name) {
  const normalizedEmail = email.toLowerCase();

  // Check if user already exists
  const existingUser = await getUserFromDbByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error(authMessages.userAlreadyExists);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(authMessages.invalidEmailFormat);
  }

  // Validate password strength
  if (!password || password.length < 6) {
    throw new Error(authMessages.passwordTooShort);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Insert user into database
  const userName = name || email.split("@")[0];
  const result = await db.query(
    "INSERT INTO `user` (email, password, name) VALUES (?, ?, ?)",
    [normalizedEmail, hashedPassword, userName]
  );

  const userId = result.insertId;

  // Get the created user and check admin status
  const dbUser = await getUserFromDbById(userId);
  if (!dbUser) {
    throw new Error("Failed to retrieve created user");
  }

  const isAdmin = await isUserAdmin(userId);

  // Generate token (use string ID for JWT compatibility)
  const token = generateToken(userId.toString(), normalizedEmail);

  // Return user without password
  const user = buildUserObject(dbUser, isAdmin);

  return {
    user,
    token,
  };
}

/**
 * Login user
 */
async function login(email, password) {
  const normalizedEmail = email.toLowerCase();

  // Find user in database (include password for verification)
  const dbUser = await getUserFromDbByEmail(normalizedEmail, true);

  if (!dbUser) {
    throw new Error(authMessages.invalidEmailOrPassword);
  }

  // Verify password
  const isValidPassword = await comparePassword(password, dbUser.password);
  if (!isValidPassword) {
    throw new Error(authMessages.invalidEmailOrPassword);
  }

  // Check if user is admin
  const isAdmin = await isUserAdmin(dbUser.user_id);

  // Generate token (use string ID for JWT compatibility)
  const token = generateToken(dbUser.user_id.toString(), dbUser.email);

  // Return user without password
  const user = buildUserObject(dbUser, isAdmin);

  return {
    user,
    token,
  };
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
  const userIdInt = parseUserId(userId);
  if (!userIdInt) {
    return null;
  }

  // Get user from database
  const dbUser = await getUserFromDbById(userIdInt);
  if (!dbUser) {
    return null;
  }

  // Check if user is admin
  const isAdmin = await isUserAdmin(userIdInt);

  // Return user without password
  return buildUserObject(dbUser, isAdmin);
}

/**
 * Get all users (admin function)
 * Returns all users without passwords
 */
async function getAllUsers() {
  // Query all users from database
  const users = await db.query(
    "SELECT user_id, email, name, creation_date, api_calls, spotify_access_token, spotify_refresh_token, spotify_token_expires_at FROM `user` ORDER BY creation_date DESC"
  );

  // Get all admin user IDs
  const adminRecords = await db.query("SELECT user_id FROM `admin`");
  const adminUserIds = new Set(adminRecords.map((admin) => admin.user_id));

  // Map users and add role based on admin table
  return users.map((dbUser) => {
    const isAdmin = adminUserIds.has(dbUser.user_id);
    return buildUserObject(dbUser, isAdmin);
  });
}

/**
 * Update user's Spotify tokens
 */
async function updateUserSpotifyTokens(userId, accessToken, refreshToken, expiresAt) {
  const userIdInt = parseUserId(userId);
  if (!userIdInt) {
    throw new Error("Invalid user ID");
  }

  await db.query(
    `UPDATE \`user\` 
     SET spotify_access_token = ?, 
         spotify_refresh_token = ?, 
         spotify_token_expires_at = ? 
     WHERE user_id = ?`,
    [accessToken, refreshToken, expiresAt ? new Date(expiresAt) : null, userIdInt]
  );
}

/**
 * Get user's Spotify tokens
 */
async function getUserSpotifyTokens(userId) {
  const userIdInt = parseUserId(userId);
  if (!userIdInt) {
    return null;
  }

  const users = await db.query(
    `SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires_at 
     FROM \`user\` 
     WHERE user_id = ?`,
    [userIdInt]
  );

  if (users.length === 0 || !users[0].spotify_access_token) {
    return null;
  }

  return {
    accessToken: users[0].spotify_access_token,
    refreshToken: users[0].spotify_refresh_token,
    expiresAt: users[0].spotify_token_expires_at ? new Date(users[0].spotify_token_expires_at).getTime() : null,
  };
}

/**
 * Clear user's Spotify tokens (disconnect)
 */
async function clearUserSpotifyTokens(userId) {
  const userIdInt = parseUserId(userId);
  if (!userIdInt) {
    throw new Error("Invalid user ID");
  }

  await db.query(
    `UPDATE \`user\` 
     SET spotify_access_token = NULL, 
         spotify_refresh_token = NULL, 
         spotify_token_expires_at = NULL 
     WHERE user_id = ?`,
    [userIdInt]
  );
}

module.exports = {
  signup,
  login,
  getUserById,
  verifyToken,
  getAllUsers,
  updateUserSpotifyTokens,
  getUserSpotifyTokens,
  clearUserSpotifyTokens,
};
