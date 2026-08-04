
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/cartContext';
import { resolveImageUrl } from '../utils/imageUrl';
import { Trash2, Plus, Minus } from 'lucide-react';

const CartPage = () => {
  const { cart, removeFromCart, updateQuantity } = useCart();

  const { totalAmount, totalItems } = useMemo(() => {
    let amount = 0;
    let items = 0;
    for (const item of cart) {
      const itemPrice = Number(item.price) || 0;
      const itemQuantity = Number(item.quantity) || 1;
      amount += itemPrice * itemQuantity;
      items += itemQuantity;
    }
    return { totalAmount: amount, totalItems: items };
  }, [cart]);

  // Empty cart state
  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4 min-h-[60vh] flex flex-col items-center justify-center">
        <img src="https://cdn-icons-png.flaticon.com/512/11329/11329060.png" alt="Empty Cart" className="w-48 h-48 mb-6 opacity-50" />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
        <Link to="/" className="bg-teal-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors">
          Start Shopping
        </Link>
      </div>
    );
  }

  // Populated cart state
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4 lg:pb-0 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">Shopping Cart ({cart.length} items)</h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Cart Items List */}
        <div className="lg:w-2/3 space-y-4">
          {cart.map((item) => (
            <div key={item._id || item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
              <img src={resolveImageUrl(item.image)} alt={item.title} loading="lazy" className="w-24 h-24 object-cover rounded-md border" />
              
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-gray-800 text-lg">{item.title}</h3>
                <p className="text-teal-600 font-bold text-xl mt-1">₹{Number(item.price).toFixed(2)}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border">
                <button onClick={() => updateQuantity(item._id || item.id, 'decrease')} className="p-1 hover:bg-white rounded shadow-sm text-gray-600" aria-label="Decrease quantity">
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span className="font-semibold w-6 text-center" aria-live="polite" aria-label={`Quantity ${item.quantity || 1}`}>{item.quantity || 1}</span>
                <button onClick={() => updateQuantity(item._id || item.id, 'increase')} className="p-1 hover:bg-white rounded shadow-sm text-gray-600" aria-label="Increase quantity">
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Delete Button */}
              <button 
                onClick={() => removeFromCart(item._id || item.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
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
                <span>Subtotal</span>
                <span className="font-semibold text-gray-800">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-green-500 font-medium">Free</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-teal-600">₹{totalAmount.toFixed(2)}</span>
            </div>
            
            <Link to="/checkout" className="w-full flex justify-center bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-teal-600 transition-colors shadow-md">
              Proceed to Checkout
            </Link>
          </div>
        </div>

      </div>

      {/* Mobile Sticky Summary Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] z-40 px-4 py-3 flex items-center gap-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
          <p className="text-lg font-bold text-teal-600 truncate">₹{totalAmount.toFixed(2)}</p>
        </div>

        <Link
          to="/checkout"
          className="flex-shrink-0 bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-teal-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          aria-label="Proceed to checkout"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
};

export default CartPage;