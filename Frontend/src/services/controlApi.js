import api from '../api/axios';

// Command-Center reads — every call hits an ALREADY-EXISTING admin/warehouse
// GET route that the admin is authorized for (protect + admin). No new
// backend endpoint, no mutation, never touches adminMutateGuard — so the C1
// rate-limit guards and adminMutateGuard are never invoked by this tab.

export const fetchCtrlStats = () => api.get('/api/admin/analytics/overview', { params: { range: 30 } });

export const fetchCtrlCharts = () => api.get('/api/admin/analytics/charts');

export const fetchCtrlDelivery = () => api.get('/api/admin/analytics/delivery');

export const fetchCtrlDeliveryPartners = () => api.get('/api/admin/delivery-partners');

export const fetchCtrlCustomers = (params) => api.get('/api/admin/analytics/customers', { params });

export const fetchCtrlInventory = () => api.get('/api/admin/analytics/inventory');

export const fetchCtrlStaff = () => api.get('/api/admin/staff');

export const fetchCtrlWarehouses = () => api.get('/api/warehouses');

export const fetchCtrlAlerts = () => api.get('/api/inventory/alerts', { params: { low: true } });

export const fetchCtrlActivity = (params) => api.get('/api/admin/user-activity', { params });

export const fetchCtrlAudit = (params) => api.get('/api/admin/audit-logs', { params });

// Single aggregated snapshot for the whole strip — Promise.all runs one
// parallel burst of existing admin reads. Each GET already handles its own
// auth/CSRF; none of them touch adminMutateGuard.
export const loadControlSnapshot = () =>
  Promise.all([
    fetchCtrlStats(),
    fetchCtrlDelivery(),
    fetchCtrlDeliveryPartners(),
    fetchCtrlInventory(),
    fetchCtrlStaff(),
    fetchCtrlWarehouses(),
    fetchCtrlAlerts()
  ]).then(([stats, delivery, partners, inventory, staff, warehouses, alerts]) => ({
    stats: stats.data,
    delivery: delivery.data,
    partners: (partners.data || {}).partners || [],
    inventory: inventory.data,
    staff: (staff.data || {}).staff || [],
    warehouses: (warehouses.data || {}).warehouses || [],
    alerts: alerts.data
  }));
