import api from '../api/axios';

export const fetchActivities = (params) => api.get('/api/admin/user-activity', { params });
export const fetchActivityMeta = () => api.get('/api/admin/user-activity/meta');