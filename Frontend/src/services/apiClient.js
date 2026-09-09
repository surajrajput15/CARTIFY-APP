/**
 * API Client Wrapper with automatic CSRF handling
 * Provides convenient methods for making API requests with automatic CSRF token management
 */

import { waitForCsrfToken, getCsrfToken } from './csrfService';
import { logError } from '../utils/logger';

/**
 * Internal function to make fetch requests with CSRF handling
 * @param {string} endpoint - API endpoint (will be prefixed with /api)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
const apiFetch = async (endpoint, options = {}) => {
  // Clone options to avoid mutating original
  const opts = { ...options };
  
  // Ensure we have credentials for cookies
  opts.credentials = 'include';
  
  // For mutations (POST, PUT, DELETE, PATCH), ensure CSRF token is handled
  if (opts.method && !['GET', 'HEAD', 'OPTIONS'].includes(opts.method.toUpperCase())) {
    try {
      // Wait for CSRF token to be available
      await waitForCsrfToken();
      
      // Add token to headers for axios compatibility
      // Note: If using our axios instance, this is handled automatically
      // But for direct fetch, we need to add it manually
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        if (!opts.headers) opts.headers = {};
        opts.headers['X-CSRF-Token'] = csrfToken;
      }
    } catch (error) {
      logError('CSRF token error:', error);
      // Still proceed - let the backend handle validation
    }
  }
  
  const response = await fetch(`/api${endpoint}`, opts);
  
  // Handle 403 by attempting to refresh CSRF token and retry once
  if (response.status === 403) {
    try {
      // Try to refresh the CSRF token
      await waitForCsrfToken();
      
      // Clone options for retry
      const retryOpts = { ...opts };
      retryOpts.credentials = 'include';
      
      // Add fresh token to headers
      const freshToken = getCsrfToken();
      if (freshToken) {
        if (!retryOpts.headers) retryOpts.headers = {};
        retryOpts.headers['X-CSRF-Token'] = freshToken;
      }
      
      // Retry the request
      const retryResponse = await fetch(`/api${endpoint}`, retryOpts);
      return retryResponse;
    } catch (retryError) {
      logError('CSRF token refresh failed:', retryError);
      // Return original 403 response
      return response;
    }
  }
  
  return response;
};

/**
 * GET request helper
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} 
 */
export const get = (url, options = {}) => apiFetch(url, { ...options, method: 'GET' });

/**
 * POST request helper
 * @param {string} url - API endpoint
 * @param {any} data - Request body data
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const post = (url, data, options = {}) => 
  apiFetch(url, { 
    ...options, 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, 
    body: JSON.stringify(data) 
  });

/**
 * PUT request helper
 * @param {string} url - API endpoint
 * @param {any} data - Request body data
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const put = (url, data, options = {}) => 
  apiFetch(url, { 
    ...options, 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, 
    body: JSON.stringify(data) 
  });

/**
 * DELETE request helper
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const del = (url, options = {}) => apiFetch(url, { ...options, method: 'DELETE' });

/**
 * PATCH request helper
 * @param {string} url - API endpoint
 * @param {any} data - Request body data
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const patch = (url, data, options = {}) => 
  apiFetch(url, { 
    ...options, 
    method: 'PATCH', 
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, 
    body: JSON.stringify(data) 
  });

export default {
  get,
  post,
  put,
  del,
  patch
};