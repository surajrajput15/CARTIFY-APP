import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './axios';
import { registerNavigator } from '../utils/navigation';

const navigateMock = vi.fn();
registerNavigator(navigateMock);

const reject401 = async (config) => {
  const error = new Error('Request failed with status code 401');
  error.config = config;
  error.response = { status: 401, data: {}, config, headers: {} };
  throw error;
};

describe('axios session-expiry redirect (F-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    api.defaults.adapter = reject401;
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('remembers the current page when the refresh attempt fails', async () => {
    // Session hint: a user record exists, so a refresh is worth attempting.
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));

    await expect(api.get('/api/orders')).rejects.toBeTruthy();

    // Refresh was attempted (the 401 path), then the user was sent to login…
    expect(navigateMock).toHaveBeenCalledWith('/login');
    // …with the exact page they were on, ready for LoginPage to consume.
    expect(sessionStorage.getItem('redirectAfterLogin')).toBe(
      `${window.location.pathname}${window.location.search}`
    );
  });

  it('does not redirect guests with no session to restore', async () => {
    await expect(api.get('/api/products')).rejects.toBeTruthy();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
  });
});
