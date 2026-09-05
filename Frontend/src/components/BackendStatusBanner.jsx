import { useState, useCallback } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useBackendStatus } from '../context/BackendStatusContext';
import api from '../api/axios';

const BackendStatusBanner = () => {
  const { isOffline, retry, retryCount } = useBackendStatus();
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    try {
      // Hit a lightweight endpoint to check connectivity
      await api.get('/health', { timeout: 5000 });
      setDismissed(true);
    } catch {
      // still down — bump retry counter so children can refetch
      retry();
    } finally {
      setChecking(false);
    }
  }, [retry]);

  if (!isOffline || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-amber-50 border-b-2 border-amber-400 px-4 py-2.5 sm:py-3"
    >
      <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-3">
        <WifiOff className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" size={20} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">Backend unavailable</p>
          <p className="text-xs text-amber-800 mt-0.5">
            We can't reach the API at <span className="font-mono">{import.meta.env.VITE_API_URL || 'http://localhost:5000'}</span>.
            Start the backend server (<span className="font-mono">cd Backend &amp;&amp; npm run dev</span>) and try again.
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleRetry}
            disabled={checking}
            aria-label="Retry connection"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50 min-h-[36px]"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
            {checking ? 'Checking…' : 'Retry'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss notification"
            className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackendStatusBanner;