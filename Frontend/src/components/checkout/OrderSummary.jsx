import { Loader2, ShieldCheck, Lock, Truck, Ticket, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { getShippingMessage } from '../../utils/constants';
import CouponInput from './CouponInput';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const OrderSummary = ({ cart = [], total, discount = 0, appliedCoupon, couponCode, setCouponCode, couponLoading, couponError, onApplyCoupon, onRemoveCoupon, onFindBestCoupon, bestCouponLoading, loading, canPay, onPay, cartItems }) => {
  const normalizedDiscount = Math.min(Math.max(0, Number(discount) || 0), Math.max(0, Number(total) || 0));
  const discountedSubtotal = Math.max(0, total - normalizedDiscount);
  // DEC-1A: the backend never charges shipping (paymentRoutes calculates
  // total = items − discount only), so the preview must show exactly that —
  // no client-side ₹79. "Free shipping over ₹999" stays marketing copy.
  const shippingMessage = discountedSubtotal <= 0
    ? { text: 'Free', className: 'text-green-600 font-medium' }
    : getShippingMessage(discountedSubtotal);
  const finalTotal = discountedSubtotal;

  // Use cartItems if provided, otherwise fall back to cart
  const itemsForCoupon = cartItems || cart;

  return (
    <aside
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit lg:sticky lg:top-24"
      aria-label="Order summary"
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

      {/* F-23: inner scroll only from sm up — on mobile the page scrolls (no scroll trap) */}
      <div className="space-y-3 mb-6 sm:max-h-60 sm:overflow-y-auto pr-2 -mr-2" aria-label="Cart items">
        {cart.map((item, index) => (
          <div key={item._id || index} className="flex justify-between items-center text-sm gap-2">
            <span className="text-gray-600 truncate flex-1" title={item.title || 'Item'}>
              {item.title || 'Item'} <span className="text-gray-500">×{item.quantity || 1}</span>
            </span>
            <span className="font-semibold text-gray-800 whitespace-nowrap">
              {formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 1))}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4 mb-4 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold text-gray-800">{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span className="flex items-center gap-1">
            <Truck size={14} aria-hidden="true" /> Shipping
          </span>
          <span className={shippingMessage.className}>{shippingMessage.text}</span>
        </div>
      </div>

      {setCouponCode && (
        <div className="mb-4 min-w-0">
          <CouponInput code={couponCode} setCode={setCouponCode} applied={appliedCoupon} loading={couponLoading} error={couponError} onApply={onApplyCoupon} onRemove={onRemoveCoupon} onFindBest={onFindBestCoupon} bestLoading={bestCouponLoading} cart={itemsForCoupon} totalAmount={total} />
        </div>
      )}

      {normalizedDiscount > 0 && appliedCoupon && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" aria-hidden="true" />
              <span className="text-sm font-bold text-green-800">Coupon Applied</span>
            </div>
            <Badge variant="success" className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium">
              <Ticket size={10} aria-hidden="true" />
              {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% OFF` : `${formatPrice(appliedCoupon.value, { showDecimals: false })} OFF`}
            </Badge>
          </div>
          <div className="flex justify-between text-sm text-green-700">
            <span>Code: <span className="font-mono font-bold">{appliedCoupon.code}</span></span>
            <span className="font-bold">Saved {formatPrice(normalizedDiscount)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-100">
        <span className="text-base sm:text-lg font-bold text-gray-800">Total</span>
        {/* F-40: coupon apply/remove changes this figure — announce it politely. */}
        <span className="text-xl sm:text-2xl font-bold text-teal-600" aria-live="polite" aria-atomic="true">{formatPrice(finalTotal)}</span>
      </div>

      {/* F-34: honest pricing — final amount confirmed by the server at payment time */}
      <p className="text-xs text-center text-gray-500 mb-4">
        Final price confirmed at checkout.
      </p>

      <Button variant="dark"
        onClick={onPay}
        disabled={loading || !canPay}
        aria-busy={loading}
        className="w-full py-3.5 rounded-xl font-bold text-base sm:text-lg transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        aria-label={loading ? 'Processing payment' : `Pay ${formatPrice(finalTotal)} now`}
      >
        {loading ? <Loader2 className="animate-spin" size={22} aria-hidden="true" /> : (
          <>
            <Lock size={18} aria-hidden="true" />
            Pay {formatPrice(finalTotal)} Now
          </>
        )}
      </Button>

      <p className="text-xs text-center text-gray-500 mt-3 flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} aria-hidden="true" /> 100% Secure Payments by Razorpay
      </p>
    </aside>
  );
};

export default OrderSummary;
