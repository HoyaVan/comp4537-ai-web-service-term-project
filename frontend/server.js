const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { parse } = require("querystring");
// const config = require("./public/config");
require("dotenv").config();

const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL;
console.log("BACKEND_URL: ", BACKEND_URL);

// Route configuration - similar to backend index.js structure
const routes = {
  // Public routes (guest only - redirect to dashboard if authenticated)
  "/": {
    page: "index.html",
    requiresGuest: true,
    redirectIfAuth: "/dashboard"
  },
  "/login": {
    page: "login.html",
    requiresGuest: true,
    redirectIfAuth: "/dashboard"
  },
  "/signup": {
    page: "signup.html",
    requiresGuest: true,
    redirectIfAuth: "/dashboard"
  },
  
  // Protected routes (require authentication)
  "/dashboard": {
    page: "dashboard.html",
    requiresAuth: true
  },
  "/profile": {
    page: "profile.html",
    requiresAuth: true
  },
  "/admin": {
    page: "admin.html",
    requiresAuth: true,
    requiresRole: "admin",
    redirectIfUnauthorized: "/dashboard"
  },
  
  // Public voting route (no auth required)
  "/vote": {
    page: "vote.html",
    public: true
  }
};

// Helper function to check authentication via backend
async function checkAuth(cookies, authHeader) {
  try {
    let token = null;
    
    // Check Authorization header first (Bearer token)
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }
    
    // Fallback to cookie for backward compatibility
    if (!token) {
      const cookieObj = parseCookies(cookies);
      token = cookieObj.token;
      if (token) {
        console.log('[server] Token found in cookie');
      } else {
        console.log('[server] No token in cookie or Authorization header');
      }
    } else {
      console.log('[server] Token found in Authorization header');
    }
    
    if (!token) {
      return { authenticated: false, user: null };
    }
    
    console.log('[server] Validating token with backend...');

    // Validate BACKEND_URL before using it
    if (!BACKEND_URL) {
      console.error("BACKEND_URL is not set");
      return { authenticated: false, user: null, error: "backend_unreachable", errorDetails: "BACKEND_URL not configured" };
    }

    let backendUrl;
    try {
      backendUrl = new URL(BACKEND_URL);
    } catch (urlError) {
      console.error("Invalid BACKEND_URL:", BACKEND_URL, urlError);
      return { authenticated: false, user: null, error: "backend_unreachable", errorDetails: "Invalid BACKEND_URL configuration" };
    }

    const httpModule = backendUrl.protocol === "https:" ? https : http;
    
    // Force IPv4 if localhost (to avoid IPv6 issues)
    let hostname = backendUrl.hostname;
    if (hostname === "localhost" || hostname === "::1") {
      hostname = "127.0.0.1";
      console.warn(`WARNING: localhost detected in BACKEND_URL, using 127.0.0.1 instead. BACKEND_URL should be the actual backend service URL in production.`);
    }
    
    return new Promise((resolve) => {
      const options = {
        hostname: hostname,
        port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
        path: "/api/v1/auth/profile",
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        },
        timeout: 5000,
        family: 4 // Force IPv4 to avoid IPv6 resolution issues
      };
      
      console.log(`Attempting auth check with backend: ${backendUrl.protocol}//${hostname}:${options.port}`);

      const req = httpModule.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              if (result.success && result.data) {
                console.log('[server] Authentication successful for user:', result.data.email);
                resolve({ authenticated: true, user: result.data });
              } else {
                console.log('[server] Authentication failed - invalid response:', result);
                resolve({ authenticated: false, user: null });
              }
            } catch (e) {
              console.error("[server] Error parsing auth response:", e);
              resolve({ authenticated: false, user: null });
            }
          } else {
            console.log('[server] Authentication failed - status code:', res.statusCode);
            resolve({ authenticated: false, user: null });
          }
        });
      });

      req.on("error", (err) => {
        console.error("Error contacting backend for auth check:", err.message);
        // If there's a network error (backend unreachable), we need to signal this
        resolve({ authenticated: false, user: null, error: "backend_unreachable", errorDetails: err.message });
      });

      // Set a timeout to detect if backend doesn't respond
      req.setTimeout(5000, () => {
        console.error("Backend auth check timeout");
        req.destroy();
        resolve({ authenticated: false, user: null, error: "backend_timeout" });
      });

      req.end();
    });
  } catch (error) {
    console.error("Unexpected error in checkAuth:", error);
    return { authenticated: false, user: null, error: "check_failed", errorDetails: error.message };
  }
}

// Parse cookies from request headers
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.trim().split("=");
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  
  return cookies;
}

// Get MIME type for file
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject"
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Serve static file
function serveStaticFile(filePath, res, statusCode = 200) {
  try {
    const fullPath = path.join(__dirname, "public", filePath);
    
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        console.error(`Error reading file ${filePath}:`, err.message);
        // If file not found and we're not already serving 404, try to serve 404.html
        if (statusCode !== 404 && filePath !== "404.html") {
          serveStaticFile("404.html", res, 404);
          return;
        }
        if (!res.headersSent) {
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end("File not found");
        }
        return;
      }
      
      try {
        const mimeType = getMimeType(filePath);
        if (!res.headersSent) {
          res.writeHead(statusCode, { "Content-Type": mimeType });
          res.end(data);
        }
      } catch (headerError) {
        console.error("Error writing response headers:", headerError);
      }
    });
  } catch (error) {
    console.error("Error in serveStaticFile:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("Internal Server Error");
    }
  }
}

// Handle route with authentication check
async function handleRoute(req, res, routePath) {
  try {
    const route = routes[routePath];
    
    if (!route) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("Route not found");
      return;
    }

    const cookies = req.headers.cookie || "";
    const authHeader = req.headers.authorization || "";
    
    // Handle public routes
    if (route.public) {
      serveStaticFile(route.page, res);
      return;
    }

  // Check authentication - server must validate before serving protected pages
  let authResult;
  try {
    authResult = await checkAuth(cookies, authHeader);
  } catch (error) {
    console.error("Error checking authentication:", error);
    // If auth check throws an error, treat as unauthenticated
    authResult = { authenticated: false, user: null, error: "check_failed", errorDetails: error.message };
  }
  
  // Check if there was an error contacting the backend
  if (authResult.error && route.requiresAuth) {
    // Backend is unreachable or timed out - don't allow access to protected pages
    console.error(`Backend unavailable (${authResult.error}): Cannot serve protected route ${routePath}`);
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Service Unavailable</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Service Temporarily Unavailable</h1>
          <p>The authentication service is currently unavailable. Please try again later.</p>
          <p><a href="/login">Return to Login</a></p>
        </body>
        </html>
      `);
    }
    return;
  }
    
    // Handle routes that require guest (redirect if authenticated)
    if (route.requiresGuest) {
      if (authResult.authenticated) {
        res.writeHead(302, {
          "Location": route.redirectIfAuth || "/dashboard"
        });
        res.end();
        return;
      }
      serveStaticFile(route.page, res);
      return;
    }

    // Handle routes that require authentication
    if (route.requiresAuth) {
      // Server-side authentication is REQUIRED - don't serve page without valid auth
      if (!authResult.authenticated) {
        res.writeHead(302, {
          "Location": "/login"
        });
        res.end();
        return;
      }

      // Check if route requires specific role
      if (route.requiresRole) {
        if (!authResult.user || authResult.user.role !== route.requiresRole) {
          // Serve 404 page instead of redirecting (security through obscurity)
          serveStaticFile("404.html", res, 404);
          return;
        }
      }

      // All checks passed - serve the page
      serveStaticFile(route.page, res);
      return;
    }

    // Default: serve the page
    serveStaticFile(route.page, res);
  } catch (error) {
    console.error("Error in handleRoute:", error);
    // Send error response
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Internal Server Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Internal Server Error</h1>
          <p>An error occurred while processing your request.</p>
          <p><a href="/">Return to Home</a></p>
        </body>
        </html>
      `);
    }
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  try {
    // Handle CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle partials (header HTML files)
    if (pathname.startsWith("/partials/")) {
      serveStaticFile(pathname, res);
      return;
    }

    // Handle static assets (js, css, images, etc.)
    if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$/)) {
      serveStaticFile(pathname, res);
      return;
    }

    // Handle API routes - proxy to backend
    if (pathname.startsWith("/api/")) {
      if (!BACKEND_URL) {
        res.writeHead(503, { "Content-Type": "text/html" });
        res.end("Backend URL not configured");
        return;
      }
      
      try {
        const backendUrl = new URL(BACKEND_URL + pathname + (parsedUrl.search || ""));
        const httpModule = backendUrl.protocol === "https:" ? https : http;
        
        const options = {
          hostname: backendUrl.hostname,
          port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
          path: backendUrl.pathname + (backendUrl.search || ""),
          method: req.method,
          headers: {
            ...req.headers,
            host: backendUrl.host
          }
        };

        const proxyReq = httpModule.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on("error", (err) => {
          console.error("Error proxying to backend:", err.message);
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/html" });
            res.end("Bad Gateway");
          }
        });

        req.pipe(proxyReq);
      } catch (error) {
        console.error("Error setting up proxy:", error);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/html" });
          res.end("Bad Gateway");
        }
      }
      return;
    }

    // Handle routes - check authentication and serve pages
    if (req.method === "GET") {
      // Normalize path (remove trailing slash, except root)
      let routePath = pathname.replace(/\/$/, "") || "/";
      
      // Check if route exists
      if (routes[routePath]) {
        await handleRoute(req, res, routePath);
      } else {
        // Route not found - serve 404.html with 404 status code
        serveStaticFile("404.html", res, 404);
      }
    } else {
      res.writeHead(405, { "Content-Type": "text/html" });
      res.end("Method not allowed");
    }
  } catch (error) {
    console.error("Unhandled error in server request handler:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Internal Server Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Internal Server Error</h1>
          <p>An unexpected error occurred. Please try again later.</p>
          <p><a href="/">Return to Home</a></p>
        </body>
        </html>
      `);
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Frontend server is running on port ${PORT}\n`);
  console.log(`📡 Backend URL: ${BACKEND_URL || 'NOT SET - THIS WILL CAUSE ERRORS'}\n`);
  console.log("📋 Available Routes:\n");
  
  Object.keys(routes).forEach((route) => {
    const config = routes[route];
    let auth = "public";
    if (config.requiresAuth) {
      auth = config.requiresRole ? `protected (${config.requiresRole})` : "protected";
    } else if (config.requiresGuest) {
      auth = "guest only";
    }
    console.log(`   GET  ${route.padEnd(15)} - ${config.page.padEnd(20)} (${auth})`);
  });
  
  console.log(`\n✅ Server ready!\n`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("Server error:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

module.exports = server;

