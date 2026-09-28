import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { AuthProvider } from './context/authContext';
import { CartProvider } from './context/cartContext';
import { CouponProvider } from './context/couponContext';
import { WishlistProvider } from './context/WishlistContext';
import { BackendStatusProvider } from './context/BackendStatusContext';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from 'react-hot-toast';
import { registerServiceWorker, listenForInstallPrompt } from './utils/pwa';
import { validateEnv } from './utils/envValidation';
import { handleApiError } from './utils/apiError';
import { fetchCsrfToken } from './api/axios';

validateEnv();

// Proactively fetch CSRF token on app startup so the cookie is available
// before any state-changing request (POST/PUT/DELETE) is made.
fetchCsrfToken();

// Surface otherwise-uncaught async errors instead of failing silently.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  // Suppress noisy unhandledrejection logs for network errors — the
  // BackendStatusBanner handles user-facing surface.
  if (event.reason?.code === 'ERR_NETWORK' || event.reason?.message?.includes('Network Error')) {
    return;
  }
  console.error('Unhandled promise rejection:', event.reason);
  // Specific cause when we can classify it (server error, session expired…),
  // honest fallback otherwise — never the raw technical error.
  toast.error(handleApiError(event.reason, 'Something unexpected happened. Please try again.'));
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
          <WishlistProvider>
            <CartProvider>
              {/* F-33: single coupon state shared by Cart + Checkout */}
              <CouponProvider>
                <App />
              </CouponProvider>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </BackendStatusProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)