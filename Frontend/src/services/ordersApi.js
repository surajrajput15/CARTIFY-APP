import api from '../api/axios';

export const fetchMyOrders = (userId) => api.get(`/api/orders/myorders/${userId}`);

export const fetchAdminOrders = (status = 'all', page = 1, limit = 20) =>
    api.get('/api/orders/admin', { params: { status, page, limit } });

export const updateOrderStatus = (orderId, status) =>
    api.patch(`/api/orders/${orderId}/status`, { status });

export const refundOrder = (orderId) => api.post(`/api/payment/refund/${orderId}`);

export const createPaymentOrder = (items, shippingAddress) =>
    api.post('/api/payment/create-order', { items, shippingAddress });

export const verifyPayment = (payload) => api.post('/api/payment/verify-payment', payload);