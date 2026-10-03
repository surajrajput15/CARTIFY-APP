import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config';

/**
 * Socket.IO Hook — manages Socket.IO connection with auth, rooms, and events.
 * 
 * Returns:
 *   socket: Socket instance (or null if not connected)
 *   connected: boolean
 *   subscribe(orderId): Promise<void> — join order room, get initial location
 *   unsubscribe(orderId): void — leave order room
 *   on(event, handler): void — listen for events
 *   off(event, handler): void — remove listener
 * 
 * Events emitted by server:
 *   - courier:location { orderId, latitude, longitude, updatedAt, partnerId? }
 *   - order:updated { orderId, status, deliveryStatus, updatedAt }
 *   - delivery:assignment { orderId, status, deliveryStatus, updatedAt }
 *   - order:assigned { orderId, deliveryPartnerId }
 * 
 * Usage:
 *   const { socket, connected, subscribe, on } = useSocket();
 *   useEffect(() => {
 *     if (!connected) return;
 *     subscribe(orderId);
 *     on('courier:location', handleLocation);
 *     return () => { unsubscribe(orderId); off('courier:location', handleLocation); };
 *   }, [connected, orderId]);
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const handlersRef = useRef(new Map());

  useEffect(() => {
    // API_ORIGIN points to the backend (e.g. http://localhost:5000), falling back to window.location.origin
    const socketUrl = API_ORIGIN || window.location.origin;

    const s = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true, // sends HttpOnly cookies
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0;
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('connect_error', (err) => {
      const msg = err?.message || '';
      // If unauthorized (guest or expired token), stop reconnection spam cleanly
      if (
        msg.toLowerCase().includes('not authorized') ||
        msg.toLowerCase().includes('token') ||
        msg.toLowerCase().includes('jwt') ||
        msg.toLowerCase().includes('suspended')
      ) {
        s.disconnect();
        return;
      }
      if (reconnectAttemptsRef.current === 0) {
        console.warn('Socket connection retry:', msg);
      }
    });

    s.on('reconnect_attempt', (attempt) => {
      reconnectAttemptsRef.current = attempt;
    });

    s.on('reconnect', () => {
      reconnectAttemptsRef.current = 0;
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, []);

  // Subscribe to order room for live tracking
  const subscribe = useCallback(async (orderId) => {
    const s = socketRef.current;
    if (!s || !s.connected) {
      throw new Error('Socket not connected');
    }
    if (!orderId) throw new Error('orderId required');
    s.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribe = useCallback((orderId) => {
    const s = socketRef.current;
    if (s && orderId) {
      s.emit('order:unsubscribe', { orderId });
    }
  }, []);

  // Event listener management
  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return;
    s.on(event, handler);
    const handlers = handlersRef.current.get(event) || [];
    handlers.push(handler);
    handlersRef.current.set(event, handlers);
  }, []);

  const off = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return;
    if (handler) {
      s.off(event, handler);
      const handlers = handlersRef.current.get(event) || [];
      handlersRef.current.set(event, handlers.filter((h) => h !== handler));
    } else {
      s.off(event);
      handlersRef.current.delete(event);
    }
  }, []);

  // Cleanup all handlers on unmount
  useEffect(() => {
    const handlersMap = handlersRef.current;
    return () => {
      handlersMap.forEach((handlers, event) => {
        const s = socketRef.current;
        if (s) {
          handlers.forEach((h) => s.off(event, h));
        }
      });
      handlersMap.clear();
    };
  }, []);

  return {
    socket,
    connected,
    subscribe,
    unsubscribe,
    on,
    off,
  };
}

export default useSocket;