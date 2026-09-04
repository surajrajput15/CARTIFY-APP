
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, Lock } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { resolveImageUrl } from '../utils/imageUrl';
import { formatPrice, truncate } from '../utils/format';
import { getShippingCost, getShippingMessage } from '../utils/constants';
import { EmptyCartIllustration } from '../components/illustrations/EmptyStateIllustrations';

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

const CartPage = () => {
  const { cart, removeFromCart, updateQuantity } = useCart();

  const { totalAmount, totalItems, shippingCost, shippingMessage } = useMemo(() => {
    let amount = 0;
    let items = 0;
    for (const item of cart) {
      const itemPrice = Number(item.price) || 0;
      const itemQuantity = Number(item.quantity) || 1;
      amount += itemPrice * itemQuantity;
      items += itemQuantity;
    }
    return {
      totalAmount: amount,
      totalItems: items,
      shippingCost: getShippingCost(amount),
      shippingMessage: getShippingMessage(amount),
    };
  }, [cart]);

  const finalTotal = totalAmount + shippingCost;

  // Empty cart state
  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4 min-h-[60vh] flex flex-col items-center justify-center">
        <EmptyCartIllustration className="w-48 h-48 sm:w-56 sm:h-56 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Looks like you haven't added anything yet. Browse our collection and find something you love.
        </p>
        <Link
          to="/"
          className="bg-teal-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-teal-700 transition-colors min-h-[44px] inline-flex items-center gap-2"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  // Populated cart state
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4 lg:pb-0 pb-28">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">
        Shopping Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
      </h1>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* Left Side: Cart Items List */}
        <div className="lg:w-2/3 space-y-4">
          {cart.map((item) => (
            <div key={item._id || item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
              <img
                src={resolveImageUrl(item.image)}
                alt={item.title || 'Cart item'}
                loading="lazy"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                className="w-24 h-24 object-cover rounded-md border flex-shrink-0"
              />

              <div className="flex-1 text-center sm:text-left min-w-0">
                <h3 className="font-semibold text-gray-800 text-base sm:text-lg line-clamp-2" title={item.title}>
                  {truncate(item.title, 80)}
                </h3>
                <p className="text-teal-600 font-bold text-xl mt-1">{formatPrice(item.price)}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border">
                <button
                  onClick={() => updateQuantity(item._id || item.id, 'decrease')}
                  className="p-2 hover:bg-white rounded shadow-sm text-gray-600 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span className="font-semibold w-6 text-center" aria-live="polite" aria-label={`Quantity ${item.quantity || 1}`}>
                  {item.quantity || 1}
                </span>
                <button
                  onClick={() => updateQuantity(item._id || item.id, 'increase')}
                  className="p-2 hover:bg-white rounded shadow-sm text-gray-600 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label="Increase quantity"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => removeFromCart(item._id || item.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Remove ${item.title} from cart`}
              >
                <Trash2 size={24} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* Right Side: Order Summary (Desktop only) */}
        <div className="hidden lg:block lg:w-1/3">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

            <div className="space-y-3 text-gray-600 border-b pb-4 mb-4">
              <div className="flex justify-between">
                <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold text-gray-800">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className={shippingMessage.className}>{shippingMessage.text}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-teal-600">{formatPrice(finalTotal)}</span>
            </div>

            <Link
              to="/checkout"
              className="w-full flex justify-center items-center gap-2 bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-teal-600 transition-colors shadow-md min-h-[44px]"
            >
              <Lock size={18} aria-hidden="true" />
              Proceed to Checkout
            </Link>

            <p className="text-xs text-center text-gray-500 mt-3">
              Estimated delivery: 3–5 business days
            </p>
          </div>
        </div>

      </div>

      {/* Mobile Sticky Summary Bar — z-30 sits BELOW the toast z-50 region */}
      <div
        className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] z-30 px-4 py-3 flex items-center gap-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
          <p className="text-lg font-bold text-teal-600 truncate">{formatPrice(finalTotal)}</p>
        </div>

        <Link
          to="/checkout"
          className="flex-shrink-0 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-teal-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 min-h-[44px] inline-flex items-center"
          aria-label="Proceed to checkout"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
};

export default CartPage;