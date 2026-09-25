import { useEffect, useRef, useState } from 'react';
import { X, Ticket, Tag, Clock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { fetchAvailableCoupons } from '../../services/couponsApi';
import { useCoupon } from '../../hooks/useCoupon';

const AvailableCouponsModal = ({ 
  isOpen, 
  onClose, 
  cart, 
  totalAmount, 
  onApplyCoupon 
}) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyingCode, setApplyingCode] = useState(null);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const { applyCoupon: applyCouponHook } = useCoupon(cart, totalAmount);

  useEffect(() => {
    if (!isOpen) return;
    
    let cancelled = false;
    setLoading(true);
    setError('');
    setCoupons([]);
    
    const itemsPayload = cart.map((i) => ({ 
      productId: i._id || i.id, 
      quantity: i.quantity, 
      category: i.category 
    }));
    
    fetchAvailableCoupons(totalAmount, itemsPayload)
      .then(({ data }) => {
        if (cancelled) return;
        setCoupons(data.coupons || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to load available coupons');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [isOpen, cart, totalAmount]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    // Focus trap - focus first focusable element
    setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      firstFocusable?.focus({ preventScroll: true });
    }, 0);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleApply = async (coupon) => {
    setApplyingCode(coupon.code);
    try {
      const itemsPayload = cart.map((i) => ({ 
        productId: i._id || i.id, 
        quantity: i.quantity, 
        category: i.category 
      }));
      const { data } = await fetchAvailableCoupons(totalAmount, itemsPayload);
      // Find the coupon in the fresh list to get validated discount
      const freshCoupon = (data.coupons || []).find(c => c.code === coupon.code);
      if (freshCoupon) {
        await applyCouponHook(freshCoupon.code);
        onClose();
      }
    } catch (err) {
      // Error handled by applyCouponHook
    } finally {
      setApplyingCode(null);
    }
  };

  const formatCouponType = (coupon) => {
    if (coupon.type === 'percentage') {
      return `${coupon.value}% OFF`;
    }
    return `₹${coupon.value} OFF`;
  };

  const getEligibilityText = (coupon) => {
    const parts = [];
    if (coupon.minOrderAmount > 0) {
      parts.push(`Min order ${formatPrice(coupon.minOrderAmount)}`);
    }
    if (coupon.maxDiscount) {
      parts.push(`Max discount ${formatPrice(coupon.maxDiscount)}`);
    }
    if (coupon.applicableCategories?.length > 0) {
      parts.push(`Categories: ${coupon.applicableCategories.join(', ')}`);
    }
    if (coupon.applicableProducts?.length > 0) {
      parts.push(`${coupon.applicableProducts.length} specific product(s)`);
    }
    if (coupon.excludedProducts?.length > 0) {
      parts.push(`${coupon.excludedProducts.length} excluded product(s)`);
    }
    return parts.join(' • ');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="available-coupons-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 id="available-coupons-title" className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Ticket size={20} className="text-teal-600" aria-hidden="true" />
            Available Coupons
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close available coupons"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 size={24} className="animate-spin text-teal-600" aria-hidden="true" />
              <p className="text-sm text-gray-500">Finding best coupons for your cart...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <AlertCircle size={32} className="text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button
                onClick={() => { /* re-fetch */ }}
                className="mt-2 text-teal-600 text-sm font-bold hover:underline"
              >
                Try again
              </button>
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Ticket size={32} className="text-gray-300" aria-hidden="true" />
              <p className="text-gray-500 text-sm">No coupons available for this cart</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Add more items or reach minimum order amount to unlock coupons
              </p>
            </div>
          ) : (
            <ul className="space-y-2" role="list" aria-label="Available coupons">
              {coupons.map((coupon) => (
                <li key={coupon.code} className="border border-gray-100 rounded-xl p-3 hover:border-teal-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-xs font-bold">
                          <Tag size={10} aria-hidden="true" />
                          {coupon.code}
                        </span>
                        <span className="text-sm font-bold text-gray-800">{formatCouponType(coupon)}</span>
                        <span className="text-green-600 text-sm font-bold ml-auto">
                          Save {formatPrice(coupon.discount)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1.5">{getEligibilityText(coupon)}</p>
                      <p className="text-xs text-gray-400">
                        Expires {new Date(coupon.validUntil).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApply(coupon)}
                      disabled={applyingCode === coupon.code || loading}
                      className="shrink-0 px-3 py-1.5 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] inline-flex items-center justify-center gap-1.5"
                      aria-label={`Apply ${coupon.code} - save ${formatPrice(coupon.discount)}`}
                    >
                      {applyingCode === coupon.code ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <>
                          Apply <ArrowRight size={12} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailableCouponsModal;