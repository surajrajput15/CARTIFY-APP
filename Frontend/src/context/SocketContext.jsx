import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const handlersRef = useRef(new Map());

  useEffect(() => {
    const socketUrl = API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!socketUrl) return;

    const s = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
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

  const subscribe = useCallback(async (orderId) => {
    const s = socketRef.current;
    if (!s || !s.connected) {
      return;
    }
    if (!orderId) return;
    s.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribe = useCallback((orderId) => {
    const s = socketRef.current;
    if (s && orderId) {
      s.emit('order:unsubscribe', { orderId });
    }
  }, []);

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

  const value = {
    socket,
    connected,
    subscribe,
    unsubscribe,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  return ctx;
}

export default SocketContext;
