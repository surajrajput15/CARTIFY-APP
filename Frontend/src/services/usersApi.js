import api from '../api/axios';

export const fetchUsers = (params) => api.get('/api/admin/users', { params });

export const fetchUserById = (id) => api.get(`/api/admin/users/${id}`);

export const fetchUserLoginHistory = (id, params) => api.get(`/api/admin/users/${id}/login-history`, { params });

export const patchUserStatus = (id, action, reason) => api.patch(`/api/admin/users/${id}/status`, { action, reason });