import { useEffect, useRef } from 'react';
import { useGoogleIdentity } from '../../context/googleIdentityContext';

const STATUS_HINT = {
  disabled: 'Google sign-in is not configured on this build.',
  'script-error': 'Google sign-in failed to load. Check your connection and refresh.',
  'origin-blocked': (
    <>
      Google sign-in is not enabled for this domain.
      <br />
      <span className="text-xs text-gray-500">
        Add <code className="bg-gray-100 px-1 rounded">window.location.origin</code> to Authorized JavaScript origins in your Google Cloud Console.
      </span>
    </>
  ),
  loading: 'Loading Google sign-in…',
};

// Renders the Google Identity Services button. All GIS state (script loading,
// redirect-mode initialization, credential verification) lives in
// GoogleIdentityProvider so the credential returned after Google's redirect is
// handled on the landing page regardless of which route it lands on.
const GoogleLoginButton = () => {
  const { status, renderButton } = useGoogleIdentity();
  const buttonContainerRef = useRef(null);

  useEffect(() => {
    const container = buttonContainerRef.current;
    if (status === 'ready' && container) {
      // Clear previous renders (React StrictMode may run this effect twice in dev).
      container.replaceChildren();
      renderButton(container);
    }
  }, [status, renderButton]);

  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>
      {status === 'disabled' || status === 'script-error' || status === 'origin-blocked' ? (
        <div
          role="status"
          className={`text-sm max-w-xs text-center px-3 py-2 rounded-lg ${
            status === 'origin-blocked' ? 'text-amber-700 bg-amber-50' : 'text-gray-500 bg-gray-50'
          }`}
        >
          {STATUS_HINT[status] || STATUS_HINT.loading}
        </div>
      ) : (
        <div ref={buttonContainerRef} className="w-full max-w-[288px]" />
      )}
    </div>
  );
};

export default GoogleLoginButton;