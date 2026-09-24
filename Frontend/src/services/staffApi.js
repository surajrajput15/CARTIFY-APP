import api from '../api/axios';

export const fetchStaff = () => api.get('/api/admin/staff');
export const createStaff = (data) => api.post('/api/admin/staff', data);
export const updateStaff = (id, data) => api.patch(`/api/admin/staff/${id}`, data);
export const demoteStaff = (id) => api.delete(`/api/admin/staff/${id}`);