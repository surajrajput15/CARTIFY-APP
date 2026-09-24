import { useEffect, useRef, useState } from 'react';
import { Ticket, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { formatPrice } from '../../utils/format';

const CouponInput = ({ code, setCode, applied, loading, error, onApply, onRemove, onFindBest, bestLoading }) => {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);
  const showForm = !applied && (expanded || Boolean(code?.trim()) || Boolean(error) || loading);

  useEffect(() => {
    if (showForm) inputRef.current?.focus({ preventScroll: true });
  }, [showForm]);

  const handleRemove = () => {
    setExpanded(false);
    onRemove();
  };

  return (
    <div className="border border-gray-100 rounded-xl px-3 py-2.5 sm:p-3.5 bg-gray-50/50 min-w-0">
      {applied ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold text-green-800">
                <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{applied.code}</span>
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {Number(applied.discount) > 0 ? `You saved ${formatPrice(applied.discount)}` : 'Coupon applied successfully'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 text-xs font-bold text-gray-500 hover:text-red-600 underline underline-offset-2 min-h-[32px] px-1"
              aria-label={`Remove coupon ${applied.code}`}
            >
              Remove
            </button>
          </div>
        </div>
      ) : showForm ? (
        <form
          onSubmit={(e) => { e.preventDefault(); onApply(); }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor="coupon-code-input" className="text-xs font-bold uppercase tracking-wide text-gray-700">
              Coupon Code
            </label>
            <button
              type="button"
              onClick={() => !loading && setExpanded(false)}
              disabled={loading}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-gray-500 hover:text-gray-800 disabled:opacity-40 min-h-[28px]"
              aria-label="Hide coupon input"
            >
              Hide <ChevronDown size={14} className="rotate-180" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
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
              className="min-w-0 w-full flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none bg-white min-h-[44px] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full sm:w-auto px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] shrink-0 inline-flex items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Apply'}
            </button>
          </div>
          {error && <p id="coupon-error" role="alert" className="text-xs text-red-600 mt-1.5 font-medium break-words">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded="false"
            aria-controls="coupon-code-input"
            className="w-full flex-1 flex items-center justify-between gap-3 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 rounded-lg"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Ticket size={16} className="text-teal-600 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-800 leading-tight">Have a coupon?</span>
                <span className="block text-xs text-gray-500 leading-tight truncate">Enter a promo code or apply the best one</span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-teal-600">Apply</span>
          </button>
          {onFindBest && (
            <button
              type="button"
              onClick={onFindBest}
              disabled={loading || bestLoading}
              className="shrink-0 px-4 py-2 border border-teal-600 text-teal-700 bg-white rounded-lg text-sm font-bold hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] inline-flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
              aria-label="Apply the best available coupon for this cart"
            >
              {bestLoading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Ticket size={15} aria-hidden="true" />}
              Best Coupon
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CouponInput;

