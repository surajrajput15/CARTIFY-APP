import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Ticket, Tag, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { fetchAvailableCoupons } from '../../services/couponsApi';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const toItemsPayload = (cart) =>
  cart.map((i) => ({ productId: i._id || i.id, quantity: i.quantity, category: i.category }));

const formatCouponType = (coupon) => (
  coupon.type === 'percentage' ? `${coupon.value}% OFF` : `${formatPrice(coupon.value, { showDecimals: false })} OFF`
);

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

// The list owns its request state. It is mounted fresh (via `key`) on every open
// and on every retry, so "loading / empty / error" is its initial state rather
// than something an effect has to reset — that keeps the reset out of the
// effect body and stops a remount from briefly showing a stale list.
const AvailableCouponsList = ({ cart, totalAmount, onApplyCoupon, onClose, onRetry }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyingCode, setApplyingCode] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchAvailableCoupons(totalAmount, toItemsPayload(cart))
      .then(({ data }) => {
        if (cancelled) return;
        setCoupons(Array.isArray(data?.coupons) ? data.coupons : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to load available coupons');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cart, totalAmount]);

  const handleApply = (coupon) => {
    // The parent validates through the canonical /api/coupons/validate endpoint,
    // so the applied discount is always server-computed and the parent's input
    // value, applied state and error message all stay in sync.
    if (typeof onApplyCoupon !== 'function') {
      onClose();
      return;
    }
    setApplyingCode(coupon.code);
    try {
      onApplyCoupon(coupon.code);
    } finally {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 size={24} className="animate-spin text-teal-600" aria-hidden="true" />
        <p className="text-sm text-gray-500">Finding best coupons for your cart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <AlertCircle size={32} className="text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 text-teal-600 text-sm font-bold hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <Ticket size={32} className="text-gray-300" aria-hidden="true" />
        <p className="text-gray-500 text-sm">No coupons available for this cart</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Add more items or reach minimum order amount to unlock coupons
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Available coupons">
      {coupons.map((coupon) => (
        <li key={coupon.code} className="border border-gray-100 rounded-xl p-3 hover:border-teal-200 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="info" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold">
                  <Tag size={10} aria-hidden="true" />
                  {coupon.code}
                </Badge>
                <span className="text-sm font-bold text-gray-800">{formatCouponType(coupon)}</span>
                <span className="text-green-600 text-sm font-bold ml-auto">
                  Save {formatPrice(coupon.discount)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1.5">{getEligibilityText(coupon)}</p>
              <p className="text-xs text-gray-500">
                Expires {new Date(coupon.validUntil).toLocaleDateString()}
              </p>
            </div>
            <Button
               onClick={() => handleApply(coupon)}
              disabled={applyingCode === coupon.code}
              className="shrink-0 px-3 py-1.5 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] inline-flex items-center justify-center gap-1.5"
              aria-label={`Apply ${coupon.code} - save ${formatPrice(coupon.discount)}`}
            >
              {applyingCode === coupon.code ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <>
                  Apply <ArrowRight size={12} aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const AvailableCouponsModal = ({
  isOpen,
  onClose,
  // Defaults matter: this modal used to be mounted unconditionally by
  // CouponInput, so an undefined cart here crashed the whole page on render.
  cart = [],
  totalAmount = 0,
  onApplyCoupon,
}) => {
  const [reloadToken, setReloadToken] = useState(0);
  const modalRef = useRef(null);

  // Memoised so the fetch effect keys on stable values. A plain
  // `Array.isArray(cart) ? cart : []` would mint a new array every render and
  // re-trigger the request in an endless loop.
  const safeCart = useMemo(() => (Array.isArray(cart) ? cart : []), [cart]);
  const safeTotal = useMemo(() => {
    const n = Number(totalAmount);
    return Number.isFinite(n) ? n : 0;
  }, [totalAmount]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus trap - focus first focusable element
    const t = setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      firstFocusable?.focus({ preventScroll: true });
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleRetry = () => setReloadToken((n) => n + 1);

  if (!isOpen) return null;

  const list = (
    <AvailableCouponsList
      key={reloadToken}
      cart={safeCart}
      totalAmount={safeTotal}
      onApplyCoupon={onApplyCoupon}
      onClose={onClose}
      onRetry={handleRetry}
    />
  );

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
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close available coupons"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {list}
        </div>
      </div>
    </div>
  );
};

export default AvailableCouponsModal;
