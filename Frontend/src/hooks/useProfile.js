import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { updateProfile, deleteAccount as deleteAccountApi } from '../services/authApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

export const useProfile = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [updateLoading, setUpdateLoading] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleToggleEdit = useCallback(() => {
    // Reset the draft to the saved name every time edit mode opens so a
    // previously typed (unsaved) value never leaks into the next edit.
    setEditName(user?.name || '');
    setIsEditing(prev => !prev);
  }, [user?.name]);

  const handleUpdateProfile = useCallback(async () => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (mountedRef.current) setUpdateLoading(true);
    try {
      const response = await updateProfile(user.id, { name: editName.trim() });
      login(response.data.user, localStorage.getItem('token'));
      if (mountedRef.current) setIsEditing(false);
      toast.success('Profile updated');
    } catch (error) {
      logError("Failed to update profile", error);
      toast.error(handleApiError(error, "Failed to update profile"));
    } finally {
      if (mountedRef.current) setUpdateLoading(false);
    }
  }, [editName, user, login]);

  const deleteAccount = useCallback(async () => {
    try {
      await deleteAccountApi(user.id);
      toast.success('Account deleted');
      logout();
      navigate('/');
    } catch (error) {
      logError("Failed to delete account", error);
      toast.error(handleApiError(error, "Failed to delete account"));
    }
  }, [user, logout, navigate]);

  return {
    isEditing,
    editName,
    setEditName,
    updateLoading,
    handleToggleEdit,
    handleUpdateProfile,
    deleteAccount
  };
};
