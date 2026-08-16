import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { GOOGLE_CLIENT_ID } from '../config';
import { googleLogin } from '../services/authApi';
import { useAuth } from './authContext';

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
// Why no `login_uri`:
//   - Setting `login_uri` makes Google POST the ID token to that endpoint,
//     which a static SPA host cannot receive, and the value must be registered
//     as an Authorized redirect URI in the Google Cloud Console (otherwise
//     Google returns Error 400 redirect_uri_mismatch). Leaving it unset makes
//     Google use the OIDC implicit flow: the JWT comes back in the URL fragment
//     of the current page and only the Authorized JavaScript origin needs to be
//     configured (which is already required for the button to render).
//
// Why initialize app-wide instead of inside the login button:
//   - Calling window.google.accounts.id.initialize() from both the button
//     and the provider double-initializes GIS ("initialize() is called
//     multiple times"), so we drop the library's auto-init entirely and own
//     the single initialization here.

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

// Guards against processing a single credential twice. In redirect mode the
// token can arrive both via the JS callback and via our URL-fragment parsing.
// Module-level flag: it resets naturally on a full page load (after Google's
// redirect back), while surviving React StrictMode's double effect run.
let credentialConsumed = false;

export const GoogleIdentityProvider = ({ children }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(() =>
    GOOGLE_CLIENT_ID ? 'loading' : 'disabled',
  );

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
        const serverResponse = await googleLogin({ credential });
        login(serverResponse.data.user, serverResponse.data.token);
        const intendedPath = sessionStorage.getItem('redirectAfterLogin');
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(intendedPath && intendedPath !== '/login' ? intendedPath : '/');
      } catch (err) {
        credentialConsumed = false; // allow the user to retry
        console.error('Google Login Error:', err);
        toast.error('Google login failed. Please try again.');
      }
    };

    // Redirect-mode fallback: after Google bounces the user back, the ID token
    // sits in the URL fragment (#id_token=...). Some browser/library combos
    // deliver it to the `callback` above, others do not — so we always parse it
    // ourselves. The `credentialConsumed` guard + fragment removal prevent a
    // duplicate exchange if both paths fire.
    const consumeHashCredential = () => {
      const match = window.location.hash.match(/[#&]id_token=([^&]+)/);
      if (!match) return;
      handleCredential({ credential: decodeURIComponent(match[1]) });
    };

    let cancelled = false;

    // Parse the fragment immediately — the token is already in the URL and does
    // not depend on the GSI script loading.
    consumeHashCredential();

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          // Redirect mode (full-page navigation) is the only mode that works on
          // every mobile browser. We deliberately omit `login_uri` so the JWT is
          // returned in the URL fragment of the current page instead of being
          // POSTed to a server endpoint that a static host cannot receive.
          ux_mode: 'redirect',
          callback: handleCredential,
        });
        setStatus('ready');
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
