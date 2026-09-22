import api from '../api/axios';

// Delivery partner orders
export const fetchAssignedDeliveries = (page = 1, limit = 20) =>
  api.get('/api/orders/delivery/assigned', { params: { page, limit } });

export const fetchCompletedDeliveries = (page = 1, limit = 20) =>
  api.get('/api/orders/delivery/completed', { params: { page, limit } });

export const fetchFailedDeliveries = (page = 1, limit = 20) =>
  api.get('/api/orders/delivery/failed', { params: { page, limit } });

// Delivery lifecycle actions
export const acceptDelivery = (orderId) => api.post(`/api/orders/${orderId}/accept-delivery`);
export const pickupDelivery = (orderId) => api.post(`/api/orders/${orderId}/pickup-delivery`);
export const outForDelivery = (orderId) => api.post(`/api/orders/${orderId}/out-for-delivery`);
export const completeDelivery = (orderId) => api.post(`/api/orders/${orderId}/complete-delivery`);
export const failDelivery = (orderId) => api.post(`/api/orders/${orderId}/fail-delivery`);

// Admin delivery assignment
export const assignDeliveryPartner = (orderId, deliveryPartnerId) =>
  api.post(`/api/orders/${orderId}/assign-delivery`, { deliveryPartnerId });

export const fetchDeliveryPartners = () => api.get('/api/admin/delivery-partners');

export const fetchAdminDeliveryOrders = (params = {}) =>
  api.get('/api/orders/admin/delivery', { params });

export default {
  fetchAssignedDeliveries,
  fetchCompletedDeliveries,
  fetchFailedDeliveries,
  acceptDelivery,
  pickupDelivery,
  outForDelivery,
  completeDelivery,
  failDelivery,
  assignDeliveryPartner,
  fetchDeliveryPartners,
  fetchAdminDeliveryOrders,
};