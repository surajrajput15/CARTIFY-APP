import api from '../api/axios';

/**
 * Public store configuration (store name, currency, contact email/phone, free shipping threshold).
 */
export const fetchPublicSettings = () => api.get('/api/settings');

/**
 * Admin store settings (all operational configurations including auto-cancel, stock thresholds, notifications).
 */
export const fetchAdminSettings = () => api.get('/api/settings/admin');

/**
 * Update store configuration settings.
 * @param {object} settings
 */
export const updateAdminSettings = (settings) => api.put('/api/settings/admin', settings);

