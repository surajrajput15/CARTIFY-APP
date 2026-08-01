import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Spinner from './components/Spinner';
import HomePage from './pages/HomePage';
import NotFound from './pages/NotFound';
import { useAuth } from './context/authContext';

const CartPage = lazy(() => import('./pages/CartPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
      <div className="min-h-screen bg-gray-50 font-sans pb-10">
        
        <Navbar />
        <Toaster position="bottom-right" reverseOrder={false} />
        
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

        <Footer />
        
      </div>
    </Router>
  );
}

export default App;
