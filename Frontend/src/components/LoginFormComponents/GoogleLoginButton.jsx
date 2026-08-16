import { useEffect, useRef } from 'react';
import { useGoogleIdentity } from '../../context/googleIdentityContext';

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
      {status === 'disabled' ? (
        <p className="text-sm text-gray-400">Google sign-in is not configured.</p>
      ) : status === 'script-error' ? (
        <p className="text-sm text-red-500">
          Google sign-in failed to load. Check your connection and refresh the page.
        </p>
      ) : (
        <div ref={buttonContainerRef} className="w-full max-w-[288px]" />
      )}
    </div>
  );
};

export default GoogleLoginButton;