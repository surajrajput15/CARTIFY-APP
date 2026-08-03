import api from '../api/axios';

export const fetchMyOrders = (userId) => api.get(`/api/orders/myorders/${userId}`);

export const createPaymentOrder = (items, shippingAddress) =>
    api.post('/api/payment/create-order', { items, shippingAddress });

export const verifyPayment = (payload) => api.post('/api/payment/verify-payment', payload);