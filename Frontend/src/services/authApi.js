import api from '../api/axios';

export const loginWithPassword = (credentials) => api.post('/api/auth/login', credentials);

export const register = (userData) => api.post('/api/auth/register', userData);

export const googleLogin = (profile) => api.post('/api/auth/google', profile);

export const sendOtp = (payload) => api.post('/api/auth/send-otp', payload);

export const verifyOtp = (payload) => api.post('/api/auth/verify-otp', payload);

export const forgotPassword = (payload) => api.post('/api/auth/forgot-password', payload);

export const resetPassword = (payload) => api.post('/api/auth/reset-password', payload);

export const updateProfile = (userId, data) => api.put(`/api/auth/update/${userId}`, data);

export const deleteAccount = (userId) => api.delete(`/api/auth/delete/${userId}`);

export const fetchCsrfToken = () => api.get('/api/auth/csrf-token');
