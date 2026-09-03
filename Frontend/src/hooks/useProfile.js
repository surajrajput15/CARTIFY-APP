import { useState, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { updateProfile, deleteAccount as deleteAccountApi } from '../services/authApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';

export const useProfile = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [updateLoading, setUpdateLoading] = useState(false);

  const handleToggleEdit = useCallback(() => setIsEditing(prev => !prev), []);

  const handleUpdateProfile = useCallback(async () => {
    if (!editName.trim()) return;
    setUpdateLoading(true);
    try {
      const response = await updateProfile(user.id, { name: editName });
      login(response.data.user, localStorage.getItem('token'));
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      toast.error(handleApiError(error, "Failed to update profile"));
    } finally {
      setUpdateLoading(false);
    }
  }, [editName, user, login]);

  const deleteAccount = useCallback(async () => {
    try {
      await deleteAccountApi(user.id);
      logout();
      navigate('/');
    } catch (error) {
      console.error("Failed to delete account", error);
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
