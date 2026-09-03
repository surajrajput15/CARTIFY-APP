export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function handleApiError(error, fallbackMessage = 'Something went wrong') {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.status === 401) {
    return 'Session expired. Please log in again.';
  }
  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (error.response?.status === 404) {
    return 'Resource not found.';
  }
  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }
  if (error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
    return 'Network error. Please check your connection.';
  }
  return fallbackMessage;
}

export async function apiCall(promise, fallbackMessage) {
  try {
    const response = await promise;
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: handleApiError(error, fallbackMessage) };
  }
}