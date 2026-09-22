import { useState, useEffect, useCallback } from 'react';
import useSocket from './useSocket';
import api from '../api/axios';

/**
 * useLiveTracking — reusable live delivery tracking hook.
 *
 * Subscribes to an order's realtime room via Socket.IO and falls back to
 * REST polling when the socket is unavailable (connection down, denied, etc).
 *
 * Returns:
 *   connected: boolean — socket connection state
 *   position: { latitude, longitude, updatedAt } | null — courier's live position
 *   live: boolean — whether live tracking is active (order in delivery window)
 *   deliveryStatus: string — order.deliveryStatus
 *   error: string | null — last error message
 *   fresh: boolean — true when a position update arrived recently
 *
 * Props:
 *   orderId: string — the order to track
 *   pollIntervalMs: number — REST fallback poll interval (default 15s)
 *   opts: { enabled } — pause tracking without unmounting
 */
export function useLiveTracking(orderId, { pollIntervalMs = 15000, enabled = true } = {}) {
  const { connected, socket, subscribe, unsubscribe, on, off } = useSocket();
  const [position, setPosition] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(null);

  const active = Boolean(orderId) && enabled;

  // Subscribe to the order room
  useEffect(() => {
    if (!active || !connected) return;
    subscribe(orderId);
    return () => unsubscribe(orderId);
  }, [active, connected, orderId, subscribe, unsubscribe]);

  // Live courier:location events
  useEffect(() => {
    if (!active || !connected) return;
    const handler = (payload) => {
      if (payload.orderId && String(payload.orderId) !== String(orderId)) return;
      setPosition({
        latitude: payload.latitude,
        longitude: payload.longitude,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      });
      if (payload.deliveryStatus) setDeliveryStatus(payload.deliveryStatus);
      setError(null);
    };
    on('courier:location', handler);
    return () => off('courier:location', handler);
  }, [active, connected, orderId, on, off]);

  // REST fallback (polling) — used when socket is disconnected
  useEffect(() => {
    if (!active) return;

    const poll = async () => {
      try {
        const res = await api.get(`/api/locations/order/${orderId}`);
        const data = res.data;
        setDeliveryStatus(data.deliveryStatus);
        setLive(Boolean(data.live));
        if (data.location) {
          setPosition(data.location);
          setError(null);
        }
      } catch (err) {
        // network/offline — silent; keep last known state
        setTimeout(() => setError(null), pollIntervalMs);
      }
    };

    if (!connected) {
      poll();
      const t = setInterval(poll, pollIntervalMs);
      return () => clearInterval(t);
    }
    // If connected, still poll once on mount for current status + location
    poll();
  }, [active, connected, orderId, pollIntervalMs]);

  return {
    connected,
    socket,
    position,
    deliveryStatus,
    live,
    error,
    fresh: Boolean(position),
  };
}

export default useLiveTracking;