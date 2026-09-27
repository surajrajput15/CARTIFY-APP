import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerNavigator, navigateToLogin, saveLoginRedirect } from './navigation';

describe('navigation utils (F-14)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    registerNavigator(null);
  });

  it('saveLoginRedirect stores the exact path for LoginPage to consume', () => {
    saveLoginRedirect('/profile?tab=orders');
    expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/profile?tab=orders');
  });

  it('saveLoginRedirect ignores /login paths (nowhere to return to)', () => {
    saveLoginRedirect('/login');
    expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
    saveLoginRedirect('/login?error=1');
    expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
  });

  it('saveLoginRedirect ignores empty paths', () => {
    saveLoginRedirect('');
    saveLoginRedirect(undefined);
    expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
  });

  it('navigateToLogin uses the registered client-side navigator', () => {
    const fn = vi.fn();
    registerNavigator(fn);
    navigateToLogin();
    expect(fn).toHaveBeenCalledWith('/login');
  });
});
