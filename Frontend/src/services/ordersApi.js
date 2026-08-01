import api from '../api/axios';

export const fetchMyOrders = (userId) => api.get(`/api/orders/myorders/${userId}`);

export const createOrder = (orderData) => api.post('/api/orders/add', orderData);

export const createPaymentOrder = (items) => api.post('/api/payment/create-order', { items });

export const verifyPayment = (payload) => api.post('/api/payment/verify-payment', payload);
