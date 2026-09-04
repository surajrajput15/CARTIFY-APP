import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/cartContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAddresses } from '../hooks/useAddresses';
import { useRazorpayPayment } from '../hooks/useRazorpayPayment';
import AddressSelector from '../components/checkout/AddressSelector';
import OrderSummary from '../components/checkout/OrderSummary';
import { formatPrice } from '../utils/format';
import { getShippingCost } from '../utils/constants';

const CheckoutPage = () => {
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const { addresses, addressesLoading, fetchAddresses } = useAddresses(user?.id, true);

  const [selectedAddress, setSelectedAddress] = useState(null);

  const calculatedTotal = useMemo(
    () => cart.reduce((total, item) => total + (Number(item.price) * (Number(item.quantity) || 1)), 0),
    [cart]
  );

  const finalTotal = useMemo(
    () => calculatedTotal + getShippingCost(calculatedTotal),
    [calculatedTotal]
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
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6 sm:mb-8 flex items-center gap-2">
        <ShieldCheck className="text-teal-600" size={28} aria-hidden="true" /> Secure Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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
    </main>
  );
};

export default CheckoutPage;
