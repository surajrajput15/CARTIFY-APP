import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { NotFoundIllustration } from '../components/illustrations/EmptyStateIllustrations';

const NotFound = () => {
  const navigate = useNavigate();
  // Go back when there is somewhere to go back to (e.g. a mistyped checkout
  // step); otherwise fall back to Home so we never eject the user from the app.
  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-10">
      <NotFoundIllustration className="w-48 h-48 sm:w-56 sm:h-56 mb-6" />
      <h1 className="text-5xl sm:text-6xl font-black text-gray-900 mb-2">404</h1>
      <p className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Page Not Found</p>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm min-h-[44px]"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Go Back
        </button>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md min-h-[44px]"
        >
          <Home size={20} aria-hidden="true" />
          Back to Home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
