import api from '../api/axios';

// Warehouse staff portal — all endpoints are scoped to the caller's assigned warehouse.
export const fetchWarehouseDashboard = () => api.get('/api/warehouse/dashboard');
export const fetchWarehouseInventory = (params) => api.get('/api/warehouse/inventory', { params });
export const setWarehouseStock = (productId, data) => api.put(`/api/warehouse/inventory/${productId}`, data);
export const fetchWarehouseAlerts = () => api.get('/api/warehouse/alerts');
export const fetchWarehouseLedger = () => api.get('/api/warehouse/ledger');
export const fetchTransferTargets = () => api.get('/api/warehouse/other-warehouses');
export const warehouseTransfer = (data) => api.post('/api/warehouse/transfer', data);