import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { ShieldX, Home, LogIn } from 'lucide-react';
import Spinner from '../components/Spinner';

const AccessDenied = () => {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) return <Spinner />;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-2 border-red-100">
            <ShieldX className="w-10 h-10 text-red-400" aria-hidden="true" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">
            You don't have permission to view this page.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 border border-gray-100">
          <p className="text-sm font-medium text-gray-700">Your role:</p>
          <p className="text-sm text-gray-500">
            {user ? (
              <>
                <span className="font-semibold text-gray-800">{user.role}</span>
                {user.isAdmin && (
                  <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    admin
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400">Not signed in</span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors min-h-[44px]"
          >
            <Home size={18} aria-hidden="true" />
            Go Home
          </button>
          {!user && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-gray-700 font-medium border border-gray-200 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              <LogIn size={18} aria-hidden="true" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default AccessDenied;
