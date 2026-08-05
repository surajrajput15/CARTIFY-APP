// Razorpay key — REQUIRED, with deliberately no fallback. A silently substituted
// test key would make the payment flow appear to work while never processing a real
// transaction. If VITE_RAZORPAY_KEY is missing the app fails loudly at startup so a
// misconfigured production build can never ship.
const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY;

if (!razorpayKey) {
  throw new Error(
    'VITE_RAZORPAY_KEY is required but was not provided. ' +
    'Set VITE_RAZORPAY_KEY in the frontend environment before building ' +
    '(Frontend/.env or the Vercel project environment variables) and redeploy. ' +
    'Cartify will not start without a valid Razorpay key.'
  );
}

export const API_URL = import.meta.env.VITE_API_URL || 'https://cartify-api-10g3.onrender.com';
export const RAZORPAY_KEY = razorpayKey;
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
