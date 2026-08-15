import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/cartContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAddresses } from '../hooks/useAddresses';
import { useRazorpayPayment } from '../hooks/useRazorpayPayment';
import AddressSelector from '../components/checkout/AddressSelector';
import OrderSummary from '../components/checkout/OrderSummary';

const CheckoutPage = () => {
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const { addresses, addressesLoading, fetchAddresses } = useAddresses(user?.id, true);

  const [selectedAddress, setSelectedAddress] = useState(null);

  const calculatedTotal = useMemo(
    () => cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0),
    [cart]
  );

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', '/checkout');
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await fetchAddresses();
      if (!cancelled && data.length > 0) {
        setSelectedAddress(data[0]);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate, fetchAddresses]);

  const { loading, handlePayment } = useRazorpayPayment({ user, cart, clearCart, navigate, selectedAddress });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-2">
        <ShieldCheck className="text-teal-600" size={32} aria-hidden="true" /> Secure Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <AddressSelector
            addresses={addresses}
            loading={addressesLoading}
            selectedAddress={selectedAddress}
            onSelect={setSelectedAddress}
            onGoToProfile={() => navigate('/profile')}
          />
        </div>

        <OrderSummary
          cart={cart}
          total={calculatedTotal}
          loading={loading}
          canPay={Boolean(selectedAddress) && cart.length > 0}
          onPay={handlePayment}
        />
      </div>
    </div>
  );
};

export default CheckoutPage;
