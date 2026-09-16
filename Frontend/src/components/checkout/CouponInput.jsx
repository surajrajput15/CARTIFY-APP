import { Ticket, X, Loader2 } from 'lucide-react';

const CouponInput = ({ code, setCode, applied, loading, error, onApply, onRemove }) => (
  <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50/50">
    <div className="flex items-center gap-2 mb-2">
      <Ticket size={16} className="text-teal-600" aria-hidden="true" />
      <span className="text-sm font-bold text-gray-800">Coupon Code</span>
      {applied && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{applied.code}</span>}
    </div>
    {applied ? (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <span className="text-sm font-bold text-green-700">{applied.code} — saved {applied.discount ? `₹${Number(applied.discount).toFixed(2)}` : ''}</span>
        <button onClick={onRemove} className="text-sm text-red-600 hover:text-red-700 font-bold min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove coupon">
          <X size={16} />
        </button>
      </div>
    ) : (
      <>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold uppercase tracking-wider focus:ring-teal-500 focus:border-teal-500"
            aria-label="Coupon code"
          />
          <button
            onClick={onApply}
            disabled={loading || !code.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[72px] inline-flex items-center justify-center gap-1"
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Apply'}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600 mt-2 font-medium">{error}</p>}
      </>
    )}
  </div>
);

export default CouponInput;
