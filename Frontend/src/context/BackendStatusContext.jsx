import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { isNetworkError } from '../utils/apiError';
import { API_ORIGIN } from '../config';

// Detects network errors anywhere in the app via the axios interceptors, which
// report every success and every network-layer failure here. The banner reads
// this state.
//
// Two rules keep the banner from flapping:
//   1. A single failed request is not an outage. One blip (a Render restart, a
//      dropped Wi-Fi frame, one 15s timeout) must not raise a page-wide alert,
//      so `FAILURE_THRESHOLD` consecutive failures are required.
//   2. Silence is not proof of recovery. The banner used to auto-hide after 8s
//      of no errors, which meant it disappeared on a timer and reappeared on
//      the next failure. Only a real answer from the server may clear it.
const BackendStatusContext = createContext({
  isOffline: false,
  isRecovering: false,
  lastErrorAt: null,
  outageId: 0,
  reportNetworkError: () => {},
  reportNetworkSuccess: () => {},
  retry: () => {},
  retryCount: 0,
  onlineCount: 0,
});

export const useBackendStatus = () => useContext(BackendStatusContext);

// Consecutive network failures needed before we call it an outage.
const FAILURE_THRESHOLD = 2;

// Bounded exponential backoff for the recovery probe (never grows past 30s).
const PROBE_BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

// Render's free tier can take a while to wake; don't abort the probe too early.
const PROBE_TIMEOUT_MS = 8000;

export const BackendStatusProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastErrorAt, setLastErrorAt] = useState(null);
  const [outageId, setOutageId] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  // Refs so the callbacks stay stable and the probe effect can read/write
  // without re-subscribing on every render.
  const failureCountRef = useRef(0);
  const offlineRef = useRef(false);
  const attemptRef = useRef(0);
  const seenRetryRef = useRef(0);

  const markOnline = useCallback(() => {
    failureCountRef.current = 0;
    if (!offlineRef.current) return;
    offlineRef.current = false;
    attemptRef.current = 0;
    setIsOffline(false);
    setIsRecovering(false);
    setOnlineCount((c) => c + 1);
  }, []);

  const reportNetworkError = useCallback(() => {
    failureCountRef.current += 1;
    if (failureCountRef.current < FAILURE_THRESHOLD) return;
    if (offlineRef.current) return;
    offlineRef.current = true;
    setIsOffline(true);
    // We have not reached the server at all yet, so this is a true outage
    // rather than a wake-up. `isRecovering` flips once a probe gets an answer.
    setIsRecovering(false);
    setLastErrorAt(Date.now());
    // A monotonic id, not a timestamp: two outages inside the same millisecond
    // must stay distinguishable (e.g. when Date.now() is frozen under test).
    setOutageId((n) => n + 1);
  }, []);

  const reportNetworkSuccess = useCallback(() => {
    // A completed request is proof the backend answered. This is the only
    // non-probe path allowed to clear the banner.
    markOnline();
  }, [markOnline]);

  const retry = useCallback(() => {
    // Reset the backoff so the next probe runs immediately, then let children
    // refetch whatever they were showing.
    attemptRef.current = 0;
    setRetryCount((c) => c + 1);
  }, []);

  // While offline, actively poll /ready until the backend answers. This is what
  // replaces the old "assume it's fine after 8 seconds" timer: the banner clears
  // because the server said so, not because requests stopped failing.
  useEffect(() => {
    if (!isOffline) {
      attemptRef.current = 0;
      seenRetryRef.current = retryCount;
      return undefined;
    }

    // A manual retry re-runs this effect; probe straight away instead of
    // making the user wait out the backoff they just tried to skip.
    const isManualRetry = seenRetryRef.current !== retryCount;
    seenRetryRef.current = retryCount;

    let cancelled = false;
    let timer = null;
    let controller = null;

    const scheduleNext = (overrideDelay) => {
      if (cancelled) return;
      const delay = overrideDelay ?? PROBE_BACKOFF_MS[
        Math.min(attemptRef.current, PROBE_BACKOFF_MS.length - 1)
      ];
      attemptRef.current += 1;
      timer = setTimeout(probe, delay);
    };

    async function probe() {
      if (cancelled) return;
      controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_ORIGIN}/ready`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.ok) {
          // Up and connected to Mongo — proof of recovery.
          markOnline();
          return;
        }
        // Reachable but not ready (Render still waking, Mongo electing a
        // primary). The server answered, so we are reconnecting rather than
        // disconnected, and it is worth keeping the banner visible.
        setIsRecovering(true);
      } catch {
        // Still unreachable — fall through to the next backoff attempt.
      } finally {
        clearTimeout(abortTimer);
      }
      if (!cancelled) scheduleNext();
    }

    scheduleNext(isManualRetry ? 0 : undefined);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [isOffline, retryCount, markOnline]);

  return (
    <BackendStatusContext.Provider
      value={{
        isOffline,
        isRecovering,
        lastErrorAt,
        outageId,
        reportNetworkError,
        reportNetworkSuccess,
        retry,
        retryCount,
        onlineCount,
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
};

export { isNetworkError };
