import api from '../api/axios';

// Warehouse staff portal — all endpoints are scoped to the caller's assigned warehouse.
// Admins have no assignment: pass warehouseId to scope explicitly (required by
// the backend in admin mode). Staff callers leave it undefined (no-op).
const withWarehouse = (params, warehouseId) =>
  warehouseId ? { ...params, warehouseId } : params;

export const fetchWarehouseDashboard = (warehouseId) => api.get('/api/warehouse/dashboard', { params: withWarehouse({}, warehouseId) });
export const fetchWarehouseInventory = (params, warehouseId) => api.get('/api/warehouse/inventory', { params: withWarehouse(params, warehouseId) });
export const setWarehouseStock = (productId, data, warehouseId) => api.put(`/api/warehouse/inventory/${productId}`, data, { params: withWarehouse({}, warehouseId) });
export const fetchWarehouseAlerts = (warehouseId) => api.get('/api/warehouse/alerts', { params: withWarehouse({}, warehouseId) });
export const fetchWarehouseLedger = (warehouseId) => api.get('/api/warehouse/ledger', { params: withWarehouse({}, warehouseId) });
export const fetchTransferTargets = (warehouseId) => api.get('/api/warehouse/other-warehouses', { params: withWarehouse({}, warehouseId) });
export const warehouseTransfer = (data) => api.post('/api/warehouse/transfer', data);