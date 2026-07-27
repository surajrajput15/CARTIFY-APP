import { Link } from 'react-router-dom';
import { Home, Frown } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md w-full text-center">
        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Frown size={40} className="text-gray-400" aria-hidden="true" />
        </div>
        <h1 className="text-6xl font-black text-gray-900 mb-2">404</h1>
        <p className="text-xl font-bold text-gray-700 mb-2">Page Not Found</p>
        <p className="text-gray-500 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md"
        >
          <Home size={20} aria-hidden="true" />
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
