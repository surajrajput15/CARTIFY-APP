import api from '../api/axios';

export const fetchAddresses = (userId) => api.get(`/api/addresses/${userId}`);

export const addAddress = (address) => api.post('/api/addresses/add', address);

export const deleteAddress = (id) => api.delete(`/api/addresses/${id}`);
