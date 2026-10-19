/**
 * CORS Configuration and Trusted Origin Security Module
 * 
 * Enforces strict origin allowlists to prevent arbitrary cross-origin access.
 * With credentials: true and production SameSite=None cookies, arbitrary
 * wildcards (such as *.vercel.app) would allow third-party Vercel deployments
 * to steal CSRF tokens and user session data.
 */

const STATIC_ALLOWED_ORIGINS = [
  'https://cartify-hub.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

// Official Cartify preview deployments on Vercel.
// Strictly anchored to hostnames prefixed with 'cartify-hub-' to match
// official project preview deployments on Vercel (e.g. cartify-hub-git-main.vercel.app).
// REJECTS:
// - https://attacker.vercel.app
// - https://evil-cartify.vercel.app
// - https://cartify-evil.vercel.app
// - https://cartify-hub.vercel.app.attacker.com
const CARTIFY_VERCEL_PREVIEW_REGEX = /^https:\/\/cartify-hub-[a-zA-Z0-9_-]+\.vercel\.app$/;

// Standard localhost pattern for development/test environments
const LOCALHOST_REGEX = /^http:\/\/localhost:\d+$/;

/**
 * Validates if an incoming Origin header is explicitly trusted.
 * 
 * @param {string|undefined} origin - Incoming Origin header
 * @returns {boolean} - True if allowed, false otherwise
 */
function isOriginAllowed(origin) {
  // Requests without an Origin header (e.g. server-to-server calls, curl, health probes)
  // are allowed. Note: Express CORS will NOT emit Access-Control-Allow-Origin when origin is absent.
  if (!origin) {
    return true;
  }

  const normalizedOrigin = String(origin).trim().replace(/\/+$/, '');

  // 1. Static production storefront & default local development origins
  if (STATIC_ALLOWED_ORIGINS.includes(normalizedOrigin)) {
    return true;
  }

  // 2. Explicitly configured FRONTEND_URL in environment (if provided)
  if (process.env.FRONTEND_URL) {
    const envFrontend = process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
    if (envFrontend && normalizedOrigin === envFrontend) {
      return true;
    }
  }

  // 3. In non-production environments, allow arbitrary localhost development ports
  if (process.env.NODE_ENV !== 'production' && LOCALHOST_REGEX.test(normalizedOrigin)) {
    return true;
  }

  // 4. Official Cartify preview deployments matching project naming pattern
  if (CARTIFY_VERCEL_PREVIEW_REGEX.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[CORS] Blocked untrusted origin:', origin);
      }
      callback(null, false);
    }
  },
  credentials: true,
};

module.exports = {
  isOriginAllowed,
  corsOptions,
  STATIC_ALLOWED_ORIGINS,
  CARTIFY_VERCEL_PREVIEW_REGEX,
  LOCALHOST_REGEX,
};
