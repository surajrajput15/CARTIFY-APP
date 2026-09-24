import api from '../api/axios';

export const fetchWarehouses = () => api.get('/api/warehouses');
export const createWarehouse = (data) => api.post('/api/warehouses', data);
export const updateWarehouse = (id, data) => api.patch(`/api/warehouses/${id}`, data);
export const deleteWarehouse = (id) => api.delete(`/api/warehouses/${id}`);

export const fetchInventory = (warehouseId, params) => api.get(`/api/inventory/${warehouseId}`, { params });
export const setStock = (warehouseId, productId, data) => api.put(`/api/inventory/${warehouseId}/product/${productId}`, data);
export const clearProductRows = (warehouseId, productId) => api.delete(`/api/inventory/${warehouseId}/product/${productId}`);
export const recomputeAllStock = () => api.post('/api/inventory/recompute');
export const fetchInventoryAlerts = (params) => api.get('/api/inventory/alerts', { params });

export const fetchStockLedger = (params) => api.get('/api/stock/ledger', { params });
export const fetchStockWarehouses = () => api.get('/api/stock/warehouses');
export const transferStock = (data) => api.post('/api/stock/transfer', data);
export const adjustStock = (data) => api.post('/api/stock/adjust', data);