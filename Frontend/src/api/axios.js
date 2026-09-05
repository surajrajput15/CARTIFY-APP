import axios from 'axios';
import { API_URL } from '../config';
import { navigateToLogin } from '../utils/navigation';
import { isNetworkError } from '../utils/apiError';

let isRefreshing = false;
let failedQueue = [];

// Track recent network errors for deduplication
let lastNetworkErrorAt = 0;
const NETWORK_ERROR_DEDUPE_MS = 2000;

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
    notifyStatus(false);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Network errors (backend down, CORS, DNS) — log as warn, not error.
    // These are expected during local dev and not real bugs.
    if (isNetworkError(error)) {
      const now = Date.now();
      if (now - lastNetworkErrorAt > NETWORK_ERROR_DEDUPE_MS) {
        lastNetworkErrorAt = now;
        // Yellow warning (not red error) for network failures
        // eslint-disable-next-line no-console
        console.warn(
          '%c[API] Backend unreachable',
          'color:#f59e0b;font-weight:bold',
          `→ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`
        );
        notifyStatus(true);
      }
      return Promise.reject(error);
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
