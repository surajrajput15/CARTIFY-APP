import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authState = vi.hoisted(() => ({ user: null, authLoading: false }));

vi.mock('../../context/authContext', () => ({
  useAuth: () => ({ user: authState.user, authLoading: authState.authLoading }),
}));

import RoleGuard from './RoleGuard';

const renderGuard = (entry, allowedRoles) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">login</div>} />
        <Route
          path="/admin/*"
          element={
            <RoleGuard allowedRoles={allowedRoles}>
              <div>admin-zone</div>
            </RoleGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <RoleGuard>
              <div>profile-zone</div>
            </RoleGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('RoleGuard (F-15 — unified route guard + return path)', () => {
  beforeEach(() => {
    authState.user = null;
    authState.authLoading = false;
    sessionStorage.clear();
  });

  it('sends guests to login and records where they were', () => {
    renderGuard('/admin?tab=orders', ['admin']);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByText('admin-zone')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/admin?tab=orders');
  });

  it('renders protected content for an allowed role without touching storage', () => {
    authState.user = { role: 'admin' };
    renderGuard('/admin', ['admin']);

    expect(screen.getByText('admin-zone')).toBeInTheDocument();
    expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
  });

  it('shows Access Denied for a signed-in user with the wrong role', () => {
    authState.user = { role: 'customer' };
    renderGuard('/admin', ['admin']);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('admin-zone')).not.toBeInTheDocument();
  });

  it('accepts any signed-in role when allowedRoles is omitted (profile)', () => {
    authState.user = { role: 'customer' };
    renderGuard('/profile');

    expect(screen.getByText('profile-zone')).toBeInTheDocument();
  });

  it('renders nothing while the JWT check is still running', () => {
    authState.authLoading = true;
    renderGuard('/admin', ['admin']);

    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-zone')).not.toBeInTheDocument();
  });
});
