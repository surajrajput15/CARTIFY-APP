import { useState } from 'react';
import { useGoogleIdentity } from '../../context/googleIdentityContext';

const GoogleLoginButton = () => {
  const { signInWithGoogle } = useGoogleIdentity();
  const [isClicking, setIsClicking] = useState(false);

  const handleClick = async () => {
    setIsClicking(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsClicking(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center border-t border-gray-200 pt-6 animate-fade-in-up">
      <p className="text-sm text-gray-500 mb-4 font-medium">Or continue with</p>

      <button
        type="button"
        onClick={handleClick}
        disabled={isClicking}
        className="w-full sm:w-[288px] flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-medium py-2.5 px-4 border border-gray-300 rounded-full shadow-sm hover:shadow transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed group"
        aria-label="Continue with Google"
      >
        <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-105" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span className="text-sm font-medium">{isClicking ? 'Opening Google…' : 'Continue with Google'}</span>
      </button>
    </div>
  );
};

export default GoogleLoginButton;