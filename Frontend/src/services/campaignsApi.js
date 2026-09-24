import api from '../api/axios';

export const fetchCampaigns = () => api.get('/api/campaigns');
export const fetchActiveCampaigns = () => api.get('/api/campaigns/active');
export const fetchCampaignPrice = (productId, price) => api.get(`/api/campaigns/active/price/${productId}`, { params: { price } });
export const createCampaign = (data) => api.post('/api/campaigns', data);
export const updateCampaign = (id, data) => api.patch(`/api/campaigns/${id}`, data);
export const toggleCampaign = (id) => api.patch(`/api/campaigns/${id}/toggle`);
export const deleteCampaign = (id) => api.delete(`/api/campaigns/${id}`);