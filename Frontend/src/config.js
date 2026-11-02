// All configuration comes from .env only (single source of truth). There is
// deliberately no fallback for API_URL: a hardcoded fallback would silently
// override a missing VITE_API_URL and duplicate the value in .env.example.
//
// Razorpay key — consumed from VITE_RAZORPAY_KEY. There is deliberately NO fallback
// key: a silently substituted test key would make the payment flow appear to work
// while never processing a real transaction.
//
// We do NOT throw here at module load. Throwing on config import would take down the
// whole store (white screen) whenever the key is missing from a build. Instead the
// key is required at the point of payment: the Razorpay handler shows a clear error
// and refuses to open the modal if RAZORPAY_KEY is empty. Browsing stays functional,
// failures are loud and user-visible, and no test key is ever used silently.
//
// API_URL is normalized to strip any trailing slashes and any trailing `/api` or `/api/v1`
// prefix so that baseURL cleanly represents the server root origin. All frontend service
// modules consistently define their endpoints starting with `/api/...`.
export const API_URL = (() => {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '').replace(/\/api(\/v1)?$/, '');
})();

export const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || '';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Bare origin of the API host, with any path prefix stripped.
// Health endpoints live at the server root, NOT under the versioned prefix.
export const API_ORIGIN = (() => {
  if (!API_URL) return '';
  try {
    return new URL(API_URL).origin;
  } catch {
    return API_URL;
  }
})();
