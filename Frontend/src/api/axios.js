import axios from 'axios';
import { API_URL } from '../config';
import { navigateToLogin, saveLoginRedirect } from '../utils/navigation';
import { isNetworkError } from '../utils/apiError';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// In-memory fallback for the CSRF token, populated from the token endpoint's
// JSON body. Primary source is the `csrfToken` cookie (set by the backend);
// the cache covers cookie-blocked/cleared edge cases so payment-grade
// requests don't depend on a single storage mechanism.
let cachedCsrfToken = null;

// Helper to get CSRF token: readable cookie first, memory cache as fallback
const getCsrfToken = () => {
  const match = document.cookie.match(/(^| )csrfToken=([^;]+)/);
  if (match) {
    cachedCsrfToken = match[2];
    return match[2];
  }
  return cachedCsrfToken;
};

// Event bus for backend status changes (avoids circular imports)
const statusListeners = new Set();
export const onBackendStatusChange = (cb) => {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
};
const notifyStatus = (isOffline) => {
  statusListeners.forEach((cb) => {
    try { cb(isOffline); } catch { /* listener error must not break status flow */ }
  });
};

// localStorage can throw in privacy/iframe contexts; treat that as "no session".
const readSessionHint = () => {
  try {
    return !!localStorage.getItem('user');
  } catch {
    return false;
  }
};

// Connection-state tracking for clean console output.
// Goal: instead of logging every failed request, log only on STATE TRANSITIONS
// (online → offline, and offline → online). The first offline transition
// shows a one-time help block; subsequent requests stay silent.
let connectionState = 'online'; // 'online' | 'offline' | 'connecting'
let hasLoggedFirstOffline = false;

const logOffline = () => {
  console.warn(
    '%c[API] Backend unreachable',
    'color:#f59e0b;font-weight:bold',
  );
  if (!hasLoggedFirstOffline) {
    hasLoggedFirstOffline = true;
    console.warn(
      '%c[Cartify] Backend is unreachable\n' +
      '  → All API requests are failing (expected when backend isn\'t running)\n' +
      '  → Start the backend: %ccd Backend && npm run dev\n' +
      '  → The yellow banner at the top of the page shows the same status\n' +
      '  → Browser-level %cnet::ERR_*%c errors come from the browser, not our code',
      'color:#f59e0b;font-weight:bold',
      'color:#0d9488',
      'color:#f59e0b',
      'color:inherit'
    );
  }
};

const logOnline = () => {
  console.log(
    '%c[API] Backend online',
    'color:#10b981;font-weight:bold',
    '— requests resumed'
  );
};

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 25000, // 25s default — gives Render free-tier cold-starts enough headroom to boot
});

// ---------------------------------------------------------------------------
// F-46: minimal GET cache + in-flight dedupe.
//  - identical concurrent GETs share one network request;
//  - a fresh GET is served from a 30s cache (route/tab revisits don't refetch);
//  - any mutation (POST/PUT/PATCH/DELETE) clears the cache;
//  - csrf-token and `dataCache: false` requests bypass the cache entirely.
// ---------------------------------------------------------------------------
const GET_CACHE_TTL_MS = 30_000;
const getCache = new Map(); // key -> { data, expires }
const inflightGets = new Map(); // key -> Promise<response>

export const clearGetCache = () => {
  getCache.clear();
  inflightGets.clear();
};

const isGet = (config) => (config.method || 'get').toLowerCase() === 'get';

const PRIVATE_ENDPOINT_PATTERNS = [
  '/api/cart',
  '/api/auth/me',
  '/api/wishlist',
  '/api/notifications',
  '/api/addresses',
  '/api/orders/myorders'
];

const getCacheKey = (config) => {
  if (!config.url || config.dataCache === false) return null;
  // Private user-scoped endpoints must always be fresh — never cached across user switches
  if (PRIVATE_ENDPOINT_PATTERNS.some((p) => config.url.includes(p))) return null;
  // The CSRF token rotates — a cached one turns every retry into a 403 loop.
  if (config.url.includes('csrf-token')) return null;
  let qs = '';
  try {
    if (config.params) {
      qs = new URLSearchParams(
        Object.entries(config.params)
          .filter(([, v]) => v !== undefined && v !== null)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      ).toString();
    }
  } catch {
    return null;
  }
  return `${config.baseURL || ''}|${config.url}|${qs}`;
};

const makeDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

api.interceptors.request.use((config) => {
  // F-46: serve GETs from cache or join an in-flight identical request.
  if (isGet(config)) {
    const key = getCacheKey(config);
    if (key) {
      const hit = getCache.get(key);
      if (hit && hit.expires > Date.now()) {
        const err = new Error('GET served from cache');
        err.__cacheHit = hit.data;
        err.config = config;
        return Promise.reject(err);
      }
      if (inflightGets.has(key)) {
        const err = new Error('GET joined in-flight request');
        err.__inflight = inflightGets.get(key);
        err.config = config;
        return Promise.reject(err);
      }
      config.__cacheKey = key;
      config.__deferred = makeDeferred();
      // Sink rejections nobody joined (the owner rethrows through the response
      // interceptor) — an unobserved rejected promise crashes Node/tests.
      config.__deferred.promise.catch(() => {});
      inflightGets.set(key, config.__deferred.promise);
    }
  } else {
    // Any mutation invalidates everything we cached (cheap + always safe).
    getCache.clear();
  }

  // Add CSRF token for state-changing requests
  const csrfToken = getCsrfToken();
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Successful response — backend is reachable
    if (connectionState !== 'online') {
      connectionState = 'online';
      logOnline();
    }
    notifyStatus(false);
    // F-46: publish to the GET cache + resolve everyone who joined this request.
    const key = response.config?.__cacheKey;
    if (key) {
      getCache.set(key, { data: response.data, expires: Date.now() + GET_CACHE_TTL_MS });
      response.config.__deferred?.resolve(response);
      inflightGets.delete(key);
    }
    return response;
  },
  async (error) => {
    // F-46: short-circuits raised by the request interceptor.
    if (error && typeof error === 'object' && '__cacheHit' in error) {
      return {
        data: error.__cacheHit,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config || {},
        request: null,
      };
    }
    if (error && typeof error === 'object' && error.__inflight) {
      return error.__inflight;
    }

    const originalRequest = error.config;
    // F-46: settle the in-flight bookkeeping before any retry logic (a retry
    // re-enters the request interceptor and must not join its own deferred).
    if (originalRequest?.__cacheKey) {
      originalRequest.__deferred?.reject(error);
      inflightGets.delete(originalRequest.__cacheKey);
    }

    // Cold start retry: Render free tier can take 25-45s to boot.
    // For idempotent GET requests, if the error is a network error (timeout/unreachable)
    // or HTTP 502/503/504 (gateway waking up), retry with backoff before declaring offline.
    const isColdStartCandidate =
      originalRequest &&
      isGet(originalRequest) &&
      !originalRequest._noRetry &&
      (isNetworkError(error) || [502, 503, 504].includes(error?.response?.status));

    if (isColdStartCandidate) {
      originalRequest._coldStartRetries = (originalRequest._coldStartRetries || 0) + 1;
      if (originalRequest._coldStartRetries <= 2) {
        // Backoff: 1500ms on first retry, 3000ms on second retry
        const backoffMs = originalRequest._coldStartRetries * 1500;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return api(originalRequest);
      }
    }

    // Network errors (backend down, CORS, DNS) — only log on STATE TRANSITIONS
    // (online → offline), not per-request. The yellow banner handles per-request UX.
    if (isNetworkError(error)) {
      if (connectionState === 'online') {
        connectionState = 'offline';
        logOffline();
      }
      notifyStatus(true);
      return Promise.reject(error);
    }

    // 403 with CSRF — re-fetch the token (it may have rotated or expired) and
    // retry the original request once. The `_csrfRetried` guard prevents loops.
    if (error.response?.status === 403 && originalRequest && !originalRequest._csrfRetried) {
      originalRequest._csrfRetried = true;
      try {
        const tokenRes = await api.get('/api/auth/csrf-token');
        // Cache the JSON token too — if the cookie write didn't stick,
        // the retry still carries a valid token via the memory fallback.
        if (tokenRes?.data?.csrfToken) {
          cachedCsrfToken = tokenRes.data.csrfToken;
        }
        // Re-read the now-fresh token (cookie first, cache fallback) and
        // attach it to the retried request.
        const freshToken = getCsrfToken();
        if (freshToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['X-CSRF-Token'] = freshToken;
        }
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const failedUrl = originalRequest?.url || '';
      const isRefreshCall = failedUrl.includes('/api/auth/refresh');
      // Session hint: httpOnly cookies are invisible to JS, so localStorage
      // 'user' tells us whether a session could plausibly exist.
      const hasSessionHint = readSessionHint();
      // Guest (no session possible): never fire refresh, never redirect.
      // This keeps guest browsing silent — no /refresh 401 noise, no login bounce.
      if (isRefreshCall || !hasSessionHint) {
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/api/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // F-14: session expired mid-use — remember where the user was so the
        // login page can send them straight back.
        saveLoginRedirect(window.location.pathname + window.location.search);
        navigateToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Helper to proactively fetch CSRF token on app startup.
// The backend sets a CSRF cookie on the first request to /api/auth/csrf-token.
// We fetch it once on app load so the cookie is available before any
// state-changing request (POST/PUT/DELETE) is made. The JSON token is also
// cached in memory as a fallback if the cookie can't be read later.
export const fetchCsrfToken = async () => {
  try {
    const res = await api.get('/api/auth/csrf-token');
    if (res?.data?.csrfToken) {
      cachedCsrfToken = res.data.csrfToken;
    }
  } catch {
    // Silent — if backend is down, the user will see the offline banner.
  }
};
