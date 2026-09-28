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
  // Force the Content-Type OFF for this request. The axios instance default
  // is 'application/json', and axios 1.18's transformRequest stringifies
  // FormData to JSON whenever a JSON content type is present — the server
  // would receive {"image":{}} instead of multipart and answer 400
  // ("Please select an image"). `null` removes the header entirely so the
  // browser emits `multipart/form-data; boundary=...` itself. (Manually
  // setting 'multipart/form-data' would strip the boundary — also broken.)
  return api.post('/api/upload', fd, { headers: { 'Content-Type': null } });
};
