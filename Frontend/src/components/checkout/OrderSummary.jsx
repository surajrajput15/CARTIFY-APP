import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';

const OrderSummary = ({ cart, total, loading, canPay, onPay }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit sticky top-24">
    <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

    <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
      {cart.map((item, index) => (
        <div key={index} className="flex justify-between items-center text-sm">
          <span className="text-gray-600 truncate w-48">{item.title} (x{item.quantity || 1})</span>
          <span className="font-bold text-gray-800">₹{item.price * (item.quantity || 1)}</span>
        </div>
      ))}
    </div>

    <div className="border-t border-gray-100 pt-4 mb-6">
      <div className="flex justify-between items-center text-lg font-extrabold text-gray-900">
        <span>Total Amount</span>
        <span>₹{total}</span>
      </div>
    </div>

    <button
      onClick={onPay}
      disabled={loading || !canPay}
      className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={loading ? 'Processing payment' : `Pay ${total} rupees`}
    >
      {loading ? <Loader2 className="animate-spin" size={24} /> : (
        <>
          <CreditCard size={20} aria-hidden="true" /> Pay ₹{total} Now
        </>
      )}
    </button>

    <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center gap-1">
      <ShieldCheck size={14} aria-hidden="true" /> 100% Secure Payments by Razorpay
    </p>
  </div>
);

export default OrderSummary;
