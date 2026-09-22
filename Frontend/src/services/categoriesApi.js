import api from '../api/axios';

export const fetchCategories = (includeInactive = false) =>
  api.get('/api/categories', { params: includeInactive ? { all: 'true' } : {} });

export const createCategory = (data) => api.post('/api/categories/add', data);

export const updateCategory = (id, data) => api.patch(`/api/categories/${id}`, data);

export const deleteCategory = (id) => api.delete(`/api/categories/${id}`);

export default {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};