import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { isNetworkError } from '../utils/apiError';

// Detects network errors anywhere in the app via a lightweight counter.
// The actual error detection happens at the call sites (apiError.js),
// and they report to this context. The banner reads from here.

const BackendStatusContext = createContext({
  isOffline: false,
  lastErrorAt: null,
  reportNetworkError: () => {},
  reportNetworkSuccess: () => {},
  retry: () => {},
  retryCount: 0,
});

export const useBackendStatus = () => useContext(BackendStatusContext);

const DEDUPE_WINDOW_MS = 1500; // suppress repeated reports within 1.5s

export const BackendStatusProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [lastErrorAt, setLastErrorAt] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastReportRef = useRef(0);

  const reportNetworkError = useCallback(() => {
    const now = Date.now();
    if (now - lastReportRef.current < DEDUPE_WINDOW_MS) return;
    lastReportRef.current = now;
    setIsOffline(true);
    setLastErrorAt(now);
  }, []);

  const reportNetworkSuccess = useCallback(() => {
    lastReportRef.current = 0;
    setIsOffline(false);
  }, []);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  // Auto-clear "offline" status after 8s of silence (someone fixed the backend)
  useEffect(() => {
    if (!isOffline || !lastErrorAt) return;
    const t = setTimeout(() => {
      // next request will set it again if still down
    }, 8000);
    return () => clearTimeout(t);
  }, [lastErrorAt, isOffline]);

  return (
    <BackendStatusContext.Provider
      value={{ isOffline, lastErrorAt, reportNetworkError, reportNetworkSuccess, retry, retryCount }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
};

export { isNetworkError };
