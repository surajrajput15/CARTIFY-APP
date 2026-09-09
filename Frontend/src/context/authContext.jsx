import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';
import { isNetworkError } from '../utils/apiError';
import { logError } from '../utils/logger';

const AuthContext = createContext();

const getInitialUser = () => {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      return JSON.parse(storedUser);
    }
  } catch {
    return null;
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);
  const [authLoading, setAuthLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUser = useCallback(async () => {
    // Fresh guest (no stored session hint): skip /me entirely — no request,
    // no 401 noise, no wasted refresh attempt.
    let hasSessionHint = false;
    try {
      hasSessionHint = !!localStorage.getItem('user');
    } catch {
      hasSessionHint = false;
    }
    if (!hasSessionHint) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      // Network errors (backend down) and 401s (not logged in) are silent.
      // The BackendStatusBanner already surfaces network failures.
      if (isNetworkError(err) || err.response?.status === 401) {
        setUser(null);
        // Clear the stale hint so reloads don't refetch /me + cart in a loop.
        try {
          localStorage.removeItem('user');
        } catch {
          // ignore storage errors
        }
        return;
      }
      // Real errors get logged.
      logError('Auth /me failed:', err);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchUser().finally(() => setAuthLoading(false));
  }, [fetchUser]);

  const login = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // Silent for network errors; log only real problems.
      if (!isNetworkError(err)) {
        logError('Logout error:', err);
      }
    } finally {
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, authLoading, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);