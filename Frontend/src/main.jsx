import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/authContext';
import { CartProvider } from './context/cartContext';
import { BackendStatusProvider } from './context/BackendStatusContext';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from 'react-hot-toast';
import { registerServiceWorker, listenForInstallPrompt } from './utils/pwa';
import { validateEnv } from './utils/envValidation';
import { fetchCsrfToken } from './api/axios';
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/browser';

validateEnv();

// Proactively fetch CSRF token on app startup so the cookie is available
// before any state-changing request (POST/PUT/DELETE) is made.
fetchCsrfToken();

// Sentry initialization
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      browserTracingIntegration(),
      Sentry.reactComponentAnnotationIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}

// Track recent network errors so we don't spam the user with duplicate toasts.
// A network failure is expected when the backend is down — we surface it once
// via the BackendStatusBanner instead of a toast for every request.
let lastNetworkErrorToastAt = 0;
const NETWORK_ERROR_TOAST_COOLDOWN_MS = 10000;

// Surface otherwise-uncaught async errors instead of failing silently.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  // Suppress noisy unhandledrejection logs for network errors — the
  // BackendStatusBanner handles user-facing surface.
  if (event.reason?.code === 'ERR_NETWORK' || event.reason?.message?.includes('Network Error')) {
    return;
  }
  console.error('Unhandled promise rejection:', event.reason);
  toast.error('Something went wrong. Please try again.');
});

window.addEventListener('error', (event) => {
  // Suppress noisy global errors from network failures
  if (event?.message?.includes('Failed to fetch') || event?.message?.includes('Network Error')) {
    return;
  }
  console.error('Uncaught error:', event.error || event.message);
});

try {
  registerServiceWorker();
} catch (err) {
  console.warn('Service worker registration skipped:', err?.message || err);
}
listenForInstallPrompt();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BackendStatusProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </BackendStatusProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Export the cooldown helper for use in axios interceptor
export { lastNetworkErrorToastAt, NETWORK_ERROR_TOAST_COOLDOWN_MS };