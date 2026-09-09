/**
 * CSRF Service for handling CSRF token operations
 * Provides a clean API for fetching and managing CSRF tokens
 */

import { fetchCsrfToken as axiosFetchCsrfToken } from '../api/axios';
import { logWarn } from '../utils/logger';

/**
 * Fetch a fresh CSRF token from the backend
 * This primes the CSRF cookie which is automatically used by axios
 * @returns {Promise<void>}
 */
export const fetchCsrfToken = async () => {
  try {
    await axiosFetchCsrfToken();
  } catch (error) {
    logWarn('Failed to fetch CSRF token:', error.message);
    // Don't throw - let the axios interceptors handle offline states
  }
};

/**
 * Get the current CSRF token from cookies
 * @returns {string|null} CSRF token or null if not found
 */
export const getCsrfToken = () => {
  const match = document.cookie.match(/(^| )csrfToken=([^;]+)/);
  return match ? match[2] : null;
};

/**
 * Wait for CSRF token to be available (useful for ensuring token before mutations)
 * @returns {Promise<string>} CSRF token
 */
export const waitForCsrfToken = async () => {
  // If we already have a token, return it immediately
  const token = getCsrfToken();
  if (token) return token;
  
  // Otherwise, fetch a fresh one
  await fetchCsrfToken();
  
  // Try to get it again
  const freshToken = getCsrfToken();
  if (freshToken) return freshToken;
  
  throw new Error('CSRF token not available after fetch attempt');
};

export default {
  fetchCsrfToken,
  getCsrfToken,
  waitForCsrfToken
};