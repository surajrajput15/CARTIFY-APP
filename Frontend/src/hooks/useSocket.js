import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config';
import SocketContext from '../context/SocketContext';

/**
 * Socket.IO Hook — manages Socket.IO connection with auth, rooms, and events.
 * If used within a <SocketProvider>, reuses the shared singleton connection.
 * If used outside, maintains an isolated fallback connection.
 */
export function useSocket() {
  const sharedContext = useContext(SocketContext);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const handlersRef = useRef(new Map());

  const isStandalone = !sharedContext;

  useEffect(() => {
    if (!isStandalone) return;
    // API_ORIGIN points to the backend (e.g. http://localhost:5000), falling back to window.location.origin
    const socketUrl = API_ORIGIN || window.location.origin;

    const s = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true, // sends HttpOnly cookies
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = s;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- store socket instance on mount
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
  }, [isStandalone]);

  // Subscribe to order room for live tracking
  const subscribe = useCallback(async (orderId) => {
    if (sharedContext) return sharedContext.subscribe(orderId);
    const s = socketRef.current;
    if (!s || !s.connected) {
      return;
    }
    if (!orderId) return;
    s.emit('order:subscribe', { orderId });
  }, [sharedContext]);

  const unsubscribe = useCallback((orderId) => {
    if (sharedContext) return sharedContext.unsubscribe(orderId);
    const s = socketRef.current;
    if (s && orderId) {
      s.emit('order:unsubscribe', { orderId });
    }
  }, [sharedContext]);

  // Event listener management
  const on = useCallback((event, handler) => {
    if (sharedContext) return sharedContext.on(event, handler);
    const s = socketRef.current;
    if (!s) return;
    s.on(event, handler);
    const handlers = handlersRef.current.get(event) || [];
    handlers.push(handler);
    handlersRef.current.set(event, handlers);
  }, [sharedContext]);

  const off = useCallback((event, handler) => {
    if (sharedContext) return sharedContext.off(event, handler);
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
  }, [sharedContext]);

  // Cleanup all handlers on unmount
  useEffect(() => {
    if (!isStandalone) return;
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
  }, [isStandalone]);

  if (sharedContext) {
    return sharedContext;
  }

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