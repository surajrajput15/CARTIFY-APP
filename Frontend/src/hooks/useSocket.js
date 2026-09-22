import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';

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
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelayRef = useRef(1000);

  const handlersRef = useRef(new Map());

  const getSocket = useCallback(() => {
    if (socket) return socket;

    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      withCredentials: true, // sends HttpOnly cookies
      auth: {
        // fallback for cross-origin if cookie not sent
        token: undefined,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      reconnectDelayRef.current = 1000;
    });

    newSocket.on('disconnect', (reason) => {
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      reconnectAttemptsRef.current = attempt;
    });

    newSocket.on('reconnect', (attempt) => {
      reconnectAttemptsRef.current = 0;
    });

    setSocket(newSocket);
    return newSocket;
  }, [socket]);

  // Initialize socket on mount
  useEffect(() => {
    const s = getSocket();
    return () => {
      if (s.connected) s.disconnect();
    };
  }, [getSocket]);

  // Subscribe to order room for live tracking
  const subscribe = useCallback(async (orderId) => {
    const s = getSocket();
    if (!s || !s.connected) {
      throw new Error('Socket not connected');
    }
    if (!orderId) throw new Error('orderId required');
    s.emit('order:subscribe', { orderId });
  }, [getSocket]);

  const unsubscribe = useCallback((orderId) => {
    const s = getSocket();
    if (s && orderId) {
      s.emit('order:unsubscribe', { orderId });
    }
  }, [getSocket]);

  // Event listener management
  const on = useCallback((event, handler) => {
    const s = getSocket();
    if (!s) return;
    s.on(event, handler);
    const handlers = handlersRef.current.get(event) || [];
    handlers.push(handler);
    handlersRef.current.set(event, handlers);
  }, [getSocket]);

  const off = useCallback((event, handler) => {
    const s = getSocket();
    if (!s) return;
    if (handler) {
      s.off(event, handler);
      const handlers = handlersRef.current.get(event) || [];
      handlersRef.current.set(event, handlers.filter((h) => h !== handler));
    } else {
      s.off(event);
      handlersRef.current.delete(event);
    }
  }, [getSocket]);

  // Cleanup all handlers on unmount
  useEffect(() => {
    return () => {
      handlersRef.current.forEach((handlers, event) => {
        handlers.forEach((h) => off(event, h));
      });
      handlersRef.current.clear();
    };
  }, [off]);

  // Expose connection status
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [getSocket]);

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