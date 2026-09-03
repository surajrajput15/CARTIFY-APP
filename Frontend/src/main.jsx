import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/authContext';
import { CartProvider } from './context/cartContext';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from 'react-hot-toast';
import { registerServiceWorker, listenForInstallPrompt } from './utils/pwa';
import { validateEnv } from './utils/envValidation';
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/browser';

validateEnv();

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

// Surface otherwise-uncaught async errors instead of failing silently.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error('Unhandled promise rejection:', event.reason);
  toast.error('Something went wrong. Please try again.');
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error || event.message);
});

registerServiceWorker();
listenForInstallPrompt();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)