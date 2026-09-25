import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Copy, Check, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/cartContext';
import { fetchAvailableCoupons } from '../../services/couponsApi';
import { formatPrice } from '../../utils/format';

const CouponsTab = () => {
  const { cart } = useCart();
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const items = cart || [];
  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch on cart/total change
    setLoading(true);
    setError('');
    if (items.length === 0) {
      setCoupons([]);
      setLoading(false);
      return;
    }
    const payload = items.map((i) => ({
      productId: i._id || i.id,
      quantity: i.quantity,
      category: i.category,
    }));
    fetchAvailableCoupons(totalAmount, payload)
      .then(({ data }) => {
        if (!cancelled) setCoupons(data.coupons || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load coupons');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cart, totalAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
      aria-label="My coupons"
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
        <Ticket size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
        My Coupons
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Coupons eligible for your current cart{totalAmount > 0 ? ` (${formatPrice(totalAmount)})` : ''}.
        Apply them at checkout.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500" role="status">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          Loading coupons…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm" role="alert">
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <ShoppingCart size={32} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-gray-600 font-medium">Your cart is empty</p>
          <p className="text-sm text-gray-500 mt-1">Add items to see which coupons apply to your order.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center gap-2 bg-teal-600 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-teal-700 transition-colors min-h-[44px]"
          >
            Browse products
          </button>
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-gray-500 text-sm mt-4">No coupons eligible for this cart right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {coupons.map((coupon) => (
            <li
              key={coupon.code}
              className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-dashed border-teal-300 bg-teal-50/50"
            >
              <div className="min-w-0">
                <p className="font-mono font-bold text-teal-800 tracking-wide">{coupon.code}</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {coupon.type === 'percentage' ? `${coupon.value}% off` : `${formatPrice(coupon.value)} off`}
                  {coupon.discount > 0 && (
                    <span className="font-semibold text-green-700"> · Save {formatPrice(coupon.discount)}</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {coupon.minOrderAmount > 0 && <>Min order {formatPrice(coupon.minOrderAmount)} · </>}
                  {coupon.validUntil && <>Valid till {new Date(coupon.validUntil).toLocaleDateString('en-IN')}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(coupon.code)}
                className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-800 bg-white border border-teal-200 rounded-lg px-3 py-2 min-h-[44px] transition-colors"
                aria-label={`Copy coupon code ${coupon.code}`}
              >
                {copied === coupon.code ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied === coupon.code ? 'Copied' : 'Copy'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default CouponsTab;
