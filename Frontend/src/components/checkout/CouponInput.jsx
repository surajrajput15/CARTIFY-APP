import { useEffect, useRef, useState } from 'react';
import { Ticket, Loader2, CheckCircle2, ChevronDown, Tag, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import AvailableCouponsModal from './AvailableCouponsModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';

const CouponInput = ({
  code = '',
  setCode,
  applied,
  loading = false,
  error = '',
  onApply,
  onRemove,
  onFindBest,
  bestLoading = false,
  // Defaults are load-bearing: CartPage rendered this without them, which fed
  // `undefined` into the coupon pipeline and threw `Cannot read properties of
  // undefined (reading 'map')` on every cart render.
  cart = [],
  totalAmount = 0,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const inputRef = useRef(null);
  const showForm = !applied && (expanded || Boolean(code?.trim()) || Boolean(error) || loading);

  useEffect(() => {
    if (showForm) inputRef.current?.focus({ preventScroll: true });
  }, [showForm]);

  const handleRemove = () => {
    setExpanded(false);
    onRemove?.();
  };

  const handleFindBest = async () => {
    if (loading || bestLoading) return;
    // Wait for the search to settle before revealing the list. The old blind
    // 500ms timer opened the modal mid-request regardless of the outcome.
    try {
      if (typeof onFindBest === 'function') await onFindBest();
    } finally {
      setShowAvailableModal(true);
    }
  };

  return (
    <div className="border border-teal-100/90 bg-gradient-to-br from-teal-50/30 via-white to-emerald-50/20 rounded-2xl p-3 sm:p-3.5 shadow-2xs min-w-0 transition-all hover:border-teal-200">
      <AvailableCouponsModal
        isOpen={showAvailableModal}
        onClose={() => setShowAvailableModal(false)}
        cart={cart}
        totalAmount={totalAmount}
        onApplyCoupon={onApply}
      />
      
      {applied ? (
        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 mt-0.5">
                <CheckCircle2 size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-sm font-bold text-emerald-900 bg-white/90 px-2 py-0.5 rounded border border-emerald-200">
                    {applied.code}
                  </span>
                  {applied.type && applied.value && (
                    <Badge variant="success" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold">
                      <Tag size={10} aria-hidden="true" />
                      {applied.type === 'percentage' ? `${applied.value}% OFF` : `${formatPrice(applied.value, { showDecimals: false })} OFF`}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-emerald-800 font-medium mt-1">
                  {Number(applied.discount) > 0 ? `You saved ${formatPrice(applied.discount)}` : 'Coupon applied successfully'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 text-xs font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
              aria-label={`Remove coupon ${applied.code}`}
            >
              Remove
            </button>
          </div>
        </div>
      ) : showForm ? (
        <form
          onSubmit={(e) => { e.preventDefault(); onApply(); }}
          aria-busy={loading}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <label htmlFor="coupon-code-input" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
              <Ticket size={13} className="text-teal-600 shrink-0" aria-hidden="true" />
              Coupon Code
            </label>
            <button
              type="button"
              onClick={() => !loading && setExpanded(false)}
              disabled={loading}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-gray-700 disabled:opacity-40 min-h-[28px]"
              aria-label="Hide coupon input"
            >
              Cancel <ChevronDown size={14} className="rotate-180" aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id="coupon-code-input"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              aria-describedby={error ? 'coupon-error' : undefined}
              aria-invalid={Boolean(error)}
              className="min-w-0 flex-1 px-3 py-2 border-gray-200 rounded-lg text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white min-h-[42px] disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-4 sm:px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed min-h-[42px] shrink-0 inline-flex items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Apply'}
            </Button>
          </div>
          {error && (
            <p id="coupon-error" role="alert" className="text-xs text-rose-600 mt-2 font-medium flex items-center gap-1 break-words">
              <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-2.5 pt-2 border-t border-dashed border-teal-100/90">
            <button
              type="button"
              onClick={handleFindBest}
              disabled={loading || bestLoading}
              aria-label="View and apply the best available coupon for this cart"
              className="w-full text-left text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center justify-between py-1 group disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-500 fill-amber-400 shrink-0" aria-hidden="true" />
                <span>Or view all available coupons</span>
              </span>
              <span className="text-[11px] font-bold text-teal-600 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Browse <ArrowRight size={11} aria-hidden="true" />
              </span>
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2.5">
          {/* Header row: Have a coupon + Apply button */}
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded="false"
              aria-controls="coupon-code-input"
              className="flex items-center gap-2.5 min-w-0 text-left group flex-1 focus:outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-teal-700 flex items-center justify-center shrink-0 group-hover:bg-teal-200/70 transition-colors">
                <Ticket size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-gray-800 leading-tight">Have a coupon?</span>
                <span className="block text-xs text-gray-500 leading-tight truncate">Enter a promo code or apply the best one</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 text-xs font-bold text-teal-700 hover:text-teal-800 bg-white hover:bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200/80 transition-colors shadow-2xs"
            >
              Apply
            </button>
          </div>

          <div className="border-t border-dashed border-teal-100/90" />

          {/* Full-width Best Coupon action pill — perfectly contained without overflow */}
          <button
            type="button"
            onClick={handleFindBest}
            disabled={loading || bestLoading}
            aria-label="View and apply the best available coupon for this cart"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white hover:bg-teal-50/60 border border-teal-500/30 hover:border-teal-500/60 text-teal-800 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 group"
          >
            <span className="flex items-center gap-2 min-w-0">
              {bestLoading ? (
                <Loader2 size={14} className="animate-spin text-teal-600 shrink-0" aria-hidden="true" />
              ) : (
                <Sparkles size={14} className="text-amber-500 fill-amber-400 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate font-bold">Best Coupon & Offers</span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 group-hover:translate-x-0.5 transition-transform">
              View offers <ArrowRight size={11} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CouponInput;

