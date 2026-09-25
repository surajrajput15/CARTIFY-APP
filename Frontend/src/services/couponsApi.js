import api from '../api/axios';

export const validateCoupon = (code, orderAmount, items) =>
  api.post('/api/coupons/validate', { code, orderAmount, items });

export const findBestCoupon = (orderAmount, items) =>
  api.post('/api/coupons/best', { orderAmount, items });

export const fetchAvailableCoupons = (orderAmount, items) =>
  api.post('/api/coupons/available', { orderAmount, items });

export const fetchCouponAnalytics = () => api.get('/api/coupons/analytics');

export const fetchCoupons = (params) => api.get('/api/coupons', { params });
export const fetchCouponById = (id) => api.get(`/api/coupons/${id}`);
export const createCoupon = (data) => api.post('/api/coupons', data);
export const updateCoupon = (id, data) => api.put(`/api/coupons/${id}`, data);
export const deleteCoupon = (id) => api.delete(`/api/coupons/${id}`);
export const toggleCoupon = (id) => api.patch(`/api/coupons/${id}/toggle`);
