import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/authContext';
import { CartProvider } from './context/cartContext';

const requiredEnvVars = [
  { key: 'VITE_API_URL', label: 'API URL' },
  { key: 'VITE_GOOGLE_CLIENT_ID', label: 'Google Client ID' },
  { key: 'VITE_RAZORPAY_KEY', label: 'Razorpay Key' },
];

const missing = requiredEnvVars.filter(v => !import.meta.env[v.key]);
if (missing.length > 0) {
  const msg = `Missing environment variables: ${missing.map(v => `${v.key} (${v.label})`).join(', ')}`;
  throw new Error(msg);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)