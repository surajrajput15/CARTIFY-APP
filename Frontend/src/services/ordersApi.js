import api from '../api/axios';

export const fetchMyOrders = (userId) => api.get(`/api/orders/myorders/${userId}`);
export const fetchOrderById = (orderId) => api.get(`/api/orders/${orderId}`);

export const fetchAdminOrders = (statusOrOptions = 'all', page = 1, limit = 20) => {
    if (typeof statusOrOptions === 'object' && statusOrOptions !== null) {
        return api.get('/api/orders/admin', { params: statusOrOptions });
    }
    return api.get('/api/orders/admin', { params: { status: statusOrOptions, page, limit } });
};

export const updateOrderStatus = (orderId, status) =>
    api.patch(`/api/orders/${orderId}/status`, { status });

export const refundOrder = (orderId) => api.post(`/api/payment/refund/${orderId}`);

export const cancelOrder = (orderId) => api.post(`/api/orders/${orderId}/cancel`);

export const createPaymentOrder = (items, shippingAddress, couponCode) =>
    api.post('/api/payment/create-order', { items, shippingAddress, couponCode });

export const verifyPayment = (payload) => api.post('/api/payment/verify-payment', payload);