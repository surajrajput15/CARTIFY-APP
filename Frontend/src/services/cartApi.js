import api from '../api/axios';

export const fetchCart = () => api.get('/api/cart');

export const mergeCart = (items) => api.post('/api/cart/merge', { items });

export const syncCart = (items) => api.put('/api/cart', { items });

export const clearServerCart = () => api.delete('/api/cart');