import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { GOOGLE_CLIENT_ID } from '../config';
import { googleLogin } from '../services/authApi';
import { useAuth } from './authContext';
import api from '../api/axios';

// Google Identity Services (GIS) redirect mode, wired up app-wide.
//
// Why redirect mode instead of popup mode:
//   - Popup mode (GIS default) opens a cross-origin popup from
//     accounts.google.com. On many mobile/in-app browsers (Samsung Internet,
//     Firefox & Opera on Android, Facebook/WhatsApp/Telegram in-app browsers,
//     and iOS Safari under Intelligent Tracking Prevention) that popup is
//     blocked or silently opens a blank window, so clicking the button does
//     nothing. Google's own docs state: "Due to ITP, redirect mode is
//     required for iOS."
//   - Redirect mode performs a full-page navigation to Google and back, which
//     works in every browser. It needs no popup, no third-party cookies and no
//     iframe↔parent messaging, so it cannot be blocked.
//
// Why an explicit `login_uri` pointing at a serverless function:
//   - With `ux_mode: 'redirect'`, Google POSTs the ID token to `login_uri`.
//     Without a `login_uri`, Google POSTs it to the current page, which a
//     static SPA host answers with 405 (Method Not Allowed). The Vercel
//     function at /api/google-auth receives the POST and 302-redirects the
//     browser to /login#id_token=..., which the app parses below and exchanges
//     with the backend (see api/google-auth.js).
//   - The value must be registered as an Authorized redirect URI in the Google
//     Cloud Console. Because it is a fixed path, it never changes with the
//     page the user happens to be on.
//
// Why initialize app-wide instead of inside the login button:
//   - Calling window.google.accounts.id.initialize() from both the button
//     and the provider double-initializes GIS ("initialize() is called
//     multiple times"), so we drop the library's auto-init entirely and own
//     the single initialization here.
//   - We also guard with an `initializedRef` so React StrictMode's double
//     effect-run doesn't cause a duplicate `initialize()` call (the warning
//     you see in dev console: "google.accounts.id.initialize() is called
//     multiple times").

const GoogleIdentityContext = createContext(null);

let gsiScriptPromise = null;
const loadGsiScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed to load'));
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
};

// Guards against processing a single credential twice (e.g. React StrictMode's
// double effect run, or a stray popup callback in dev). Resets on a full page
// load, which happens naturally after Google's redirect back.
let credentialConsumed = false;

export const GoogleIdentityProvider = ({ children }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  // Pre-derive initial state — when no client ID is set we are permanently
  // disabled (no script load, no init), and we know that synchronously.
  const [status, setStatus] = useState(() =>
    GOOGLE_CLIENT_ID ? 'loading' : 'disabled',
  );
  // Track whether the GIS library has actually been initialized for this
  // provider instance — prevents StrictMode's double effect from calling
  // google.accounts.id.initialize() twice.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredential = async (response) => {
      const credential = response?.credential;
      // Never keep the ID token in the URL fragment once consumed.
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );

      if (!credential || credentialConsumed) return;
      credentialConsumed = true;

      try {
        // Verify the ID token server-side; never decode/trust it locally.
        await googleLogin({ credential });
        // After successful login, fetch user via /me endpoint
        const { data } = await api.get('/api/auth/me');
        login(data.user);
        const intendedPath = sessionStorage.getItem('redirectAfterLogin');
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(intendedPath && intendedPath !== '/login' ? intendedPath : '/');
      } catch (err) {
        credentialConsumed = false; // allow the user to retry
        console.error('Google Login Error:', err);
        toast.error('Google login failed. Please try again.');
      }
    };

    // The serverless function hands the token back to us in the URL fragment
    // (#id_token=...); parse it ourselves and exchange it with the backend.
    const consumeHashCredential = () => {
      const match = window.location.hash.match(/[#&]id_token=([^&]+)/);
      if (!match) return;
      handleCredential({ credential: decodeURIComponent(match[1]) });
    };

    let cancelled = false;

    // Parse the fragment immediately — the token is already in the URL and does
    // not depend on the GSI script loading.
    consumeHashCredential();

    // Skip re-initialization if React StrictMode invoked this effect twice
    // (only the first invocation should call google.accounts.id.initialize).
    if (initializedRef.current) {
      return () => { cancelled = true; };
    }

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        if (initializedRef.current) return;
        initializedRef.current = true;
        try {
          if (import.meta.env.DEV) {
            // Local dev (`vite dev`) has no Vercel function, so fall back to
            // popup mode, which delivers the token straight to the callback.
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              ux_mode: 'popup',
              callback: handleCredential,
            });
          } else {
            // Production: redirect mode — Google POSTs the ID token to the
            // serverless function, which bounces the browser back to /login with
            // the token in the URL fragment. GIS forbids combining `login_uri`
            // with `callback`, so the token is consumed via fragment parsing.
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              ux_mode: 'redirect',
              login_uri: `${window.location.origin}/api/google-auth`,
            });
          }
          setStatus('ready');
        } catch (err) {
          // "The given origin is not allowed for the given client ID" — the
          // domain isn't registered in Google Cloud Console. Surface a clear
          // status so the UI can show a helpful notice instead of a dead button.
          console.warn('Google Identity Services init failed:', err?.message || err);
          setStatus('origin-blocked');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('script-error');
      });

    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  const renderButton = useCallback((container) => {
    // Clamp the button to the available width so it never overflows the card
    // and becomes unreachable on narrow phone screens.
    const width = container.clientWidth
      ? Math.min(288, container.clientWidth)
      : 288;
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width,
    });
  }, []);

  return (
    <GoogleIdentityContext.Provider
      value={{ status, renderButton, clientId: GOOGLE_CLIENT_ID }}
    >
      {children}
    </GoogleIdentityContext.Provider>
  );
};

export const useGoogleIdentity = () => {
  const context = useContext(GoogleIdentityContext);
  if (!context) {
    throw new Error('useGoogleIdentity must be used within GoogleIdentityProvider');
  }
  return context;
};