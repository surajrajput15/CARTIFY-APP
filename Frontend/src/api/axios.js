import axios from 'axios';
import { API_URL } from '../config';
import { navigateToLogin } from '../utils/navigation';
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

// Helper to get CSRF token from cookie
const getCsrfToken = () => {
  const match = document.cookie.match(/(^| )csrfToken=([^;]+)/);
  return match ? match[2] : null;
};

// Event bus for backend status changes (avoids circular imports)
const statusListeners = new Set();
export const onBackendStatusChange = (cb) => {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
};
const notifyStatus = (isOffline) => {
  statusListeners.forEach((cb) => {
    try { cb(isOffline); } catch {}
  });
};

// Connection-state tracking for clean console output.
// Goal: instead of logging every failed request, log only on STATE TRANSITIONS
// (online → offline, and offline → online). The first offline transition
// shows a one-time help block; subsequent requests stay silent.
let connectionState = 'online'; // 'online' | 'offline' | 'connecting'
let hasLoggedFirstOffline = false;

const logOffline = () => {
  // eslint-disable-next-line no-console
  console.warn(
    '%c[API] Backend unreachable',
    'color:#f59e0b;font-weight:bold',
  );
  if (!hasLoggedFirstOffline) {
    hasLoggedFirstOffline = true;
    // eslint-disable-next-line no-console
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
  // eslint-disable-next-line no-console
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
  timeout: 15000, // 15s default — prevents hung requests on dead backend
});

api.interceptors.request.use((config) => {
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
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

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
        await api.get('/api/auth/csrf-token');
        // Re-read the now-fresh cookie and attach it to the retried request.
        const freshToken = getCsrfToken();
        if (freshToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['X-CSRF-Token'] = freshToken;
        }
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
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
// state-changing request (POST/PUT/DELETE) is made.
export const fetchCsrfToken = async () => {
  try {
    await api.get('/api/auth/csrf-token');
  } catch {
    // Silent — if backend is down, the user will see the offline banner.
  }
};
