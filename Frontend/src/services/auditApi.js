import api from '../api/axios';

export const fetchAuditLogs = (params) => api.get('/api/admin/audit-logs', { params });
export const fetchAuditMeta = () => api.get('/api/admin/audit-logs/meta');
