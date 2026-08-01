import api from '../api/axios';

export const fetchProducts = (params) => api.get('/api/products', { params });

export const fetchProductById = (id) => api.get(`/api/products/${id}`);

export const addProduct = (product) => api.post('/api/products/add', product);

export const updateProduct = (id, product) => api.patch(`/api/products/${id}`, product);

export const deleteProduct = (id) => api.delete(`/api/products/${id}`);

export const seedProducts = (products) => api.post('/api/products/seed', products);

export const clearAllProducts = () => api.delete('/api/products/clear');

export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/api/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
