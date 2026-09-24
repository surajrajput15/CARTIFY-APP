import api from '../api/axios';

export const createReview = (data) => api.post('/api/reviews', data);

export const fetchProductReviews = (productId) => api.get(`/api/reviews/product/${productId}`);

export const fetchMyReviews = () => api.get('/api/reviews/my');

export const fetchAdminReviews = (params) => api.get('/api/admin/reviews', { params });

export const patchReviewStatus = (id, status) => api.patch(`/api/admin/reviews/${id}/status`, { status });