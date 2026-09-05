// API error utilities: classify, format, and react to errors uniformly.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Detect a network-layer failure (backend unreachable, CORS preflight, DNS
 * error, request aborted). These are distinct from 4xx/5xx HTTP responses, which
 * arrive with a populated `error.response` object.
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  // Axios marks these distinctly
  if (error.code === 'ERR_NETWORK') return true;
  if (error.code === 'ECONNABORTED') return true;
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ETIMEDOUT') return true;
  // message-based fallback (covers older Axios + browser XHR errors)
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('network error')) return true;
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('connection refused')) return true;
  if (msg.includes('err_connection')) return true;
  return false;
};

/**
 * Format an unknown error into a user-friendly string.
 */
export function handleApiError(error, fallbackMessage = 'Something went wrong') {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  const status = error?.response?.status;
  if (status === 401) return 'Session expired. Please log in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'Resource not found.';
  if (status >= 500) return 'Server error. Please try again later.';
  if (isNetworkError(error)) return 'Backend unavailable. Please try again later.';
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('Network Error')) {
    return 'Network error. Please check your connection.';
  }
  return fallbackMessage;
}

/**
 * Run an axios promise and return a tagged result. Never throws.
 *   { data, error, isNetworkError: boolean }
 */
export async function apiCall(promise, fallbackMessage) {
  try {
    const response = await promise;
    return { data: response.data, error: null, isNetworkError: false };
  } catch (error) {
    return {
      data: null,
      error: handleApiError(error, fallbackMessage),
      isNetworkError: isNetworkError(error),
    };
  }
}