import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Spinner from './components/Spinner';
import HomePage from './pages/HomePage';
import NotFound from './pages/NotFound';
import { GoogleIdentityProvider } from './context/googleIdentityContext';
import { useAuth } from './context/authContext';
import { registerNavigator } from './utils/navigation';

const CartPage = lazy(() => import('./pages/CartPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    registerNavigator(navigate);
  }, [navigate]);
  return null;
}

function App() {
  const { authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-600" size={36} />
      </div>
    );
  }

  return (
    <Router>
      <GoogleIdentityProvider>
        <div className="min-h-screen bg-gray-50 font-sans pb-10">
          
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:text-teal-600 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
          >
            Skip to main content
          </a>

          <NavigationBridge />
          <Navbar />
          <Toaster
            position="bottom-right"
            reverseOrder={false}
            toastOptions={{ ariaProps: { 'aria-live': 'polite', role: 'status' } }}
          />
          
          <main id="main-content">
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/product/:id" element={<ProductDetailsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>

          <Footer />
          
        </div>
      </GoogleIdentityProvider>
    </Router>
  );
}

export default App;
