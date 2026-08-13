import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { GOOGLE_CLIENT_ID } from '../config';
import { googleLogin } from '../services/authApi';
import { useAuth } from './authContext';

// Google Identity Services (GIS) redirect mode, wired up app-wide.
//
// Why app-wide instead of inside the login button:
//   - Redirect mode takes the user away to Google and lands them back on
//     window.location.origin (Google rejects localhost redirect URIs that
//     contain a path). GIS only re-fires the callback if the script is
//     loaded AND initialized on that landing page, so the initialization
//     (with the credential callback) must exist on every route.
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

export const GoogleIdentityProvider = ({ children }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(() =>
    GOOGLE_CLIENT_ID ? 'loading' : 'disabled',
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredential = async (response) => {
      try {
        const credential = response?.credential;
        // Never keep the ID token in the URL fragment once consumed.
        window.history.replaceState(null, '', window.location.pathname);

        if (!credential) {
          toast.error('Google sign-in was blocked. Please try again.');
          return;
        }

        // Verify the ID token server-side; never decode/trust it locally.
        const serverResponse = await googleLogin({ credential });
        login(serverResponse.data.user, serverResponse.data.token);
        navigate('/');
      } catch (err) {
        console.error('Google Login Error:', err);
        toast.error('Google login failed. Please try again.');
      }
    };

    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'redirect',
          // Pathless so it matches the authorized redirect URI exactly.
          redirect_uri: window.location.origin,
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
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 288,
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