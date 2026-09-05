// Friendly hostnames that are allowed by default in Google Cloud Console
// for OAuth. If the current origin is NOT in this list and GOOGLE_CLIENT_ID
// is set, we'll warn the developer in the console to add it.
const KNOWN_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'https://cartify-hub.vercel.app',
]);

export function validateEnv() {
  const required = ['VITE_API_URL'];
  const missing = required.filter((key) => !import.meta.env[key]);

  if (missing.length > 0) {
    const msg = `[Cartify] Missing required environment variables: ${missing.join(', ')}.\n` +
      `Create a .env file based on .env.example and restart the dev server.`;
    if (import.meta.env.DEV) {
      console.error(msg);
    }
    throw new Error(msg);
  }

  if (import.meta.env.DEV) {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '(ssr)';
    const googleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const googleWarning =
      googleId && !KNOWN_DEV_ORIGINS.has(currentOrigin)
        ? ` (current origin "${currentOrigin}" is not in the known dev origins list — if Google sign-in fails, add it to Authorized JavaScript origins in Google Cloud Console)`
        : '';

    // Use a template string instead of an object literal — some browsers'
    // DevTools render trailing object args as just `Object`, hiding the values.
    // Destructured primitive args always expand inline.
    console.info(
      '[Cartify] Environment validated:',
      `API=${import.meta.env.VITE_API_URL} | Razorpay=${import.meta.env.VITE_RAZORPAY_KEY ? 'configured' : 'missing'} | Google=${googleId ? `configured${googleWarning}` : 'missing'}`
    );
  }
}

export function getEnv(key, defaultValue = '') {
  const value = import.meta.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value;
}