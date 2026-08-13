import { useEffect, useRef } from 'react';
import { useGoogleOAuth } from '@react-oauth/google';
import { googleLogin } from '../../services/authApi';

// Google Identity Services (GIS) REDIRECT mode replaces the library's default popup flow.
// Popups are unreliable on mobile browsers (iOS Safari / private mode, in-app browsers,
// third-party cookie blocking) and silently return nothing when blocked. Full-page redirect
// works identically on desktop and mobile: user is taken to Google, then back to /login,
// where GIS re-fires the callback with the verified ID-token credential.
const GoogleLoginButton = ({ login, navigate, setError }) => {
  const { clientId, scriptLoadedSuccessfully, scriptError } = useGoogleOAuth();
  const buttonContainerRef = useRef(null);

  useEffect(() => {
    const container = buttonContainerRef.current;
    if (!clientId || !scriptLoadedSuccessfully || !container) return;

    // Clear previous renders (React StrictMode may run this effect twice in dev).
    container.replaceChildren();

    try {
      const handleCredential = async (response) => {
        try {
          const credential = response?.credential;
          // Never keep the ID token in the URL fragment once consumed.
          window.history.replaceState(null, '', window.location.pathname);

          if (!credential) {
            setError('Google sign-in was blocked. Please try again.');
            return;
          }

          // Verify the ID token server-side; never decode/trust it locally.
          const serverResponse = await googleLogin({ credential });
          login(serverResponse.data.user, serverResponse.data.token);
          navigate('/');
        } catch (err) {
          console.error('Google Login Error:', err);
          setError('Google login failed. Please try again.');
        }
      };

      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'redirect',
        redirect_uri: `${window.location.origin}/login`,
        callback: handleCredential,
      });

      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 288,
      });
    } catch (err) {
      console.error('Google render error:', err);
      setError('Google sign-in could not be initialized. Please refresh and try again.');
    }
  }, [clientId, scriptLoadedSuccessfully, login, navigate, setError]);

  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>
      {!clientId ? (
        <p className="text-sm text-gray-400">Google sign-in is not configured.</p>
      ) : scriptError ? (
        <p className="text-sm text-red-500">
          Google sign-in failed to load. Check your connection and refresh the page.
        </p>
      ) : (
        <div ref={buttonContainerRef} />
      )}
    </div>
  );
};

export default GoogleLoginButton;