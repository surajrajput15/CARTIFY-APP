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
    console.info('[Cartify] Environment validated:', {
      API_URL: import.meta.env.VITE_API_URL,
      RAZORPAY_KEY: import.meta.env.VITE_RAZORPAY_KEY ? 'configured' : 'missing',
      GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'configured' : 'missing',
    });
  }
}

export function getEnv(key, defaultValue = '') {
  const value = import.meta.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value;
}