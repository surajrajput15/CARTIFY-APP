import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * GPS Hook — handles browser Geolocation API with permissions, throttling, and error states.
 * 
 * Returns:
 *   position: { latitude, longitude, accuracy, timestamp } | null
 *   error: { code, message } | null
 *   loading: boolean — true while waiting for first fix
 *   permission: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'checking'
 *   start(): Promise<void> — start watching position
 *   stop(): void — stop watching
 * 
 * Usage:
 *   const { position, error, loading, start, stop } = useGPS();
 *   useEffect(() => { start(); return stop; }, []);
 */
export function useGPS(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 5000,
    throttleMs = 10000, // minimum interval between position updates
  } = options;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState('checking');

  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Check permission status on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermission('unsupported');
      return;
    }
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      setPermission(status.state);
      status.onchange = () => setPermission(status.state);
    });
  }, []);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback((pos) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) return;
    lastUpdateRef.current = now;

    setPosition({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    });
    setError(null);
    setLoading(false);
  }, [throttleMs]);

  const handleError = useCallback((err) => {
    setLoading(false);
    let message = 'Geolocation error';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable in browser settings.';
        setPermission('denied');
        break;
      case err.POSITION_UNAVAILABLE:
        message = 'Location unavailable. GPS signal may be blocked.';
        break;
      case err.TIMEOUT:
        message = 'Location request timed out.';
        break;
      default:
        message = err.message || 'Unknown geolocation error';
    }
    setError({ code: err.code, message });
  }, []);

  const start = useCallback(async () => {
    if (!navigator.geolocation) {
      setError({ code: -1, message: 'Geolocation not supported' });
      setPermission('unsupported');
      return;
    }
    setLoading(true);
    setError(null);

    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });

    // Start watching for continuous updates
    clearWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [handleSuccess, handleError, enableHighAccuracy, timeout, maximumAge, clearWatch]);

  const stop = useCallback(() => {
    clearWatch();
    setLoading(false);
  }, [clearWatch]);

  // Cleanup on unmount
  useEffect(() => () => clearWatch(), [clearWatch]);

  return {
    position,
    error,
    loading,
    permission,
    start,
    stop,
  };
}

export default useGPS;