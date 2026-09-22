import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/authContext';
import { changePassword as changePasswordApi } from '../services/authApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

/**
 * Change-password flow for the Account Settings tab.
 * The backend verifies the current password, enforces the password policy,
 * rotates session tokens and reissues auth cookies — this hook only handles
 * the request lifecycle (loading, StrictMode-safe unmount guard, toasts).
 *
 * @returns {{ changing: boolean, changePassword: (currentPassword: string, newPassword: string) => Promise<boolean> }}
 *          `changePassword` resolves to true on success, false on failure.
 */
export const useChangePassword = () => {
  const { user } = useAuth();
  const [changing, setChanging] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (mountedRef.current) setChanging(true);
    try {
      await changePasswordApi(user.id, { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      return true;
    } catch (error) {
      logError('Failed to change password', error);
      toast.error(handleApiError(error, 'Failed to change password'));
      return false;
    } finally {
      if (mountedRef.current) setChanging(false);
    }
  }, [user]);

  return { changing, changePassword };
};