import { Loader2, ShieldCheck, Lock, Truck } from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { getShippingCost } from '../../utils/constants';
import CouponInput from './CouponInput';

const OrderSummary = ({ cart, total, discount = 0, appliedCoupon, couponCode, setCouponCode, couponLoading, couponError, onApplyCoupon, onRemoveCoupon, loading, canPay, onPay }) => {
  const normalizedDiscount = Math.min(Math.max(0, Number(discount) || 0), Math.max(0, Number(total) || 0));
  const discountedSubtotal = Math.max(0, total - normalizedDiscount);
  // Backend charges shipping on the discounted total and forces ₹0 shipping on
  // fully-discounted (free) orders — mirror that so the preview never shows ₹79
  // while Razorpay charges ₹0.
  const shippingCost = discountedSubtotal <= 0 ? 0 : getShippingCost(discountedSubtotal);
  const finalTotal = Math.max(0, discountedSubtotal + shippingCost);

  return (
    <aside
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 h-fit lg:sticky lg:top-24"
      aria-label="Order summary"
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

      <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 -mr-2" aria-label="Cart items">
        {cart.map((item, index) => (
          <div key={item._id || index} className="flex justify-between items-center text-sm gap-2">
            <span className="text-gray-600 truncate flex-1" title={item.title || 'Item'}>
              {item.title || 'Item'} <span className="text-gray-400">×{item.quantity || 1}</span>
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
          <span className={shippingCost === 0 ? 'text-green-600 font-medium' : 'text-gray-700'}>
            {shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}
          </span>
        </div>
      </div>

      {setCouponCode && (
        <div className="mb-4 min-w-0">
          <CouponInput code={couponCode} setCode={setCouponCode} applied={appliedCoupon} loading={couponLoading} error={couponError} onApply={onApplyCoupon} onRemove={onRemoveCoupon} />
        </div>
      )}

      {normalizedDiscount > 0 && (
        <div className="flex justify-between text-sm text-green-600 mb-4">
          <span>Discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}</span>
          <span className="font-bold">−{formatPrice(normalizedDiscount)}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 pt-2 border-t border-gray-100">
        <span className="text-base sm:text-lg font-bold text-gray-800">Total</span>
        <span className="text-xl sm:text-2xl font-bold text-teal-600">{formatPrice(finalTotal)}</span>
      </div>

      <button
        onClick={onPay}
        disabled={loading || !canPay}
        className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold text-base sm:text-lg hover:bg-teal-600 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        aria-label={loading ? 'Processing payment' : `Pay ${formatPrice(finalTotal)} now`}
      >
        {loading ? <Loader2 className="animate-spin" size={22} aria-hidden="true" /> : (
          <>
            <Lock size={18} aria-hidden="true" />
            Pay {formatPrice(finalTotal)} Now
          </>
        )}
      </button>

      <p className="text-xs text-center text-gray-500 mt-3 flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} aria-hidden="true" /> 100% Secure Payments by Razorpay
      </p>
    </aside>
  );
};

export default OrderSummary;
