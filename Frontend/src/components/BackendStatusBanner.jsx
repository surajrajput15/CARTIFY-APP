import { useState, useCallback } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useBackendStatus } from '../context/BackendStatusContext';
import { getBackendAdvice, getBackendHeadline } from '../utils/backendStatusMessage';

const apiTarget = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const BackendStatusBanner = ({ prodBuild }) => {
  const { isOffline, isRecovering, outageId, retry } = useBackendStatus();
  // F-27: production must not see the API URL or dev-server instructions.
  // `prodBuild` exists so tests can exercise the production branch.
  const isProd = prodBuild ?? import.meta.env.PROD;
  // Dismissal is scoped to a single outage: keyed by outageId so a *new*
  // incident shows the banner again, while the dismissed one stays hidden.
  const [dismissedId, setDismissedId] = useState(null);
  const [checking, setChecking] = useState(false);

  const dismissed = dismissedId !== null && dismissedId === outageId;

  // Retry hands control to the provider's /ready probe instead of firing its own
  // request. The old version called api.get('/health'), which resolved against
  // VITE_API_URL's path prefix and 404'd whenever that value included /api/v1.
  const handleRetry = useCallback(() => {
    setChecking(true);
    retry();
    setTimeout(() => setChecking(false), 1500);
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
          <p className="text-sm font-bold text-amber-900">
            {getBackendHeadline(isRecovering)}
          </p>
          <p className="text-xs text-amber-800 mt-0.5 break-words">
            {isProd ? (
              <>We can&apos;t reach Cartify right now.{' '}</>
            ) : (
              <>
                We can&apos;t reach the API at <span className="font-mono break-all">{apiTarget}</span>.{' '}
              </>
            )}
            {getBackendAdvice(isProd)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleRetry}
            disabled={checking}
            aria-label="Retry connection"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
            {checking ? 'Checking…' : 'Retry now'}
          </button>
          <button
            onClick={() => setDismissedId(outageId)}
            aria-label="Dismiss notification"
            className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackendStatusBanner;
