const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { parse } = require("querystring");

const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

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
      token = parseCookies(cookies).token;
    }
    
    if (!token) {
      return { authenticated: false, user: null };
    }

    const backendUrl = new URL(BACKEND_URL);
    const httpModule = backendUrl.protocol === "https:" ? https : http;
    
    return new Promise((resolve) => {
      const options = {
        hostname: backendUrl.hostname,
        port: backendUrl.port || (backendUrl.protocol === "https:" ? 443 : 80),
        path: "/api/auth/profile",
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      };

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
                resolve({ authenticated: true, user: result.data });
              } else {
                resolve({ authenticated: false, user: null });
              }
            } catch (e) {
              resolve({ authenticated: false, user: null });
            }
          } else {
            resolve({ authenticated: false, user: null });
          }
        });
      });

      req.on("error", (err) => {
        // If there's a network error (backend unreachable), we need to signal this
        resolve({ authenticated: false, user: null, error: "backend_unreachable", errorDetails: err.message });
      });

      // Set a timeout to detect if backend doesn't respond
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ authenticated: false, user: null, error: "backend_timeout" });
      });

      req.end();
    });
  } catch (error) {
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
  const fullPath = path.join(__dirname, "public", filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // If file not found and we're not already serving 404, try to serve 404.html
      if (statusCode !== 404 && filePath !== "404.html") {
        serveStaticFile("404.html", res, 404);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("File not found");
      return;
    }
    
    const mimeType = getMimeType(filePath);
    res.writeHead(statusCode, { "Content-Type": mimeType });
    res.end(data);
  });
}

// Handle route with authentication check
async function handleRoute(req, res, routePath) {
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
  const authResult = await checkAuth(cookies, authHeader);
  
  // Check if there was an error contacting the backend
  if (authResult.error && route.requiresAuth) {
    // Backend is unreachable or timed out - don't allow access to protected pages
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
      // Clear any invalid token query parameter and redirect to login
      const cleanPath = routePath.replace(/\?.*$/, '');
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
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle static assets (js, css, images, etc.)
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$/)) {
    serveStaticFile(pathname, res);
    return;
  }

  // Handle API routes - proxy to backend
  if (pathname.startsWith("/api/")) {
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
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("Bad Gateway");
    });

    req.pipe(proxyReq);
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
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 Frontend server is running on port ${PORT}\n`);
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

module.exports = server;

