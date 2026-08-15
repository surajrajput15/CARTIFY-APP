import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/authContext';
import { CartProvider } from './context/cartContext';
import ErrorBoundary from './components/ErrorBoundary';
import { toast } from 'react-hot-toast';

// Surface otherwise-uncaught async errors instead of failing silently.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error('Unhandled promise rejection:', event.reason);
  toast.error('Something went wrong. Please try again.');
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error || event.message);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)