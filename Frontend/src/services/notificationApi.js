import api from '../api/axios';

export const fetchMyNotifications = (params) => api.get('/api/notifications/mine', { params });

export const markNotificationRead = (id) => api.patch(`/api/notifications/${id}/read`);

export const fetchAdminNotifications = (params) => api.get('/api/admin/notifications', { params });

export const createNotification = (data) => api.post('/api/admin/notifications', data);