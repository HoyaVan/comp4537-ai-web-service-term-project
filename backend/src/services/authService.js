const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// In-memory user storage (replace with database in production)
const users = [];

// JWT secret (in production, use environment variable)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

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
  // Check if user already exists
  const existingUser = users.find((user) => user.email === email.toLowerCase());
  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  // Validate password strength
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user object
  const userId = Date.now().toString(); // Simple ID generation
  const user = {
    id: userId,
    email: email.toLowerCase(),
    password: hashedPassword,
    name: name || email.split("@")[0],
    createdAt: new Date().toISOString(),
  };

  // Store user
  users.push(user);

  // Generate token
  const token = generateToken(user.id, user.email);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    token,
  };
}

/**
 * Login user
 */
async function login(email, password) {
  // Find user
  const user = users.find((u) => u.email === email.toLowerCase());
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  // Generate token
  const token = generateToken(user.id, user.email);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    token,
  };
}

/**
 * Get user by ID
 */
function getUserById(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return null;
  }
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

module.exports = {
  signup,
  login,
  getUserById,
  verifyToken,
};
