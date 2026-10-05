import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  MapPin, 
  CreditCard, 
  Copy, 
  Check, 
  ArrowRight, 
  ShoppingBag, 
  AlertCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchOrderById } from '../services/ordersApi';
import { formatPrice } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';
import Card from '../components/ui/Card';

const OrderConfirmationPage = () => {
  const { id } = useParams();
  usePageTitle('Order Confirmed - Cartify');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await fetchOrderById(id);
        if (isMounted) {
          setOrder(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to retrieve order confirmation details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (id) {
      loadOrder();
    }
    return () => { isMounted = false; };
  }, [id]);

  const copyOrderId = () => {
    if (!order?._id) return;
    navigator.clipboard.writeText(order._id);
    setCopied(true);
    toast.success('Order ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const calculateEstimatedDelivery = (createdAt) => {
    if (!createdAt) return '3-5 Business Days';
    const date = new Date(createdAt);
    date.setDate(date.getDate() + 4);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse" id="order-confirmation-loading">
        <div className="h-44 bg-teal-50 rounded-3xl mb-8 flex flex-col items-center justify-center p-6 border border-teal-100">
          <div className="w-16 h-16 bg-teal-200 rounded-full mb-4"></div>
          <div className="w-64 h-6 bg-teal-200 rounded mb-2"></div>
          <div className="w-48 h-4 bg-teal-100 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="h-64 bg-gray-100 rounded-2xl"></div>
            <div className="h-40 bg-gray-100 rounded-2xl"></div>
          </div>
          <div className="h-80 bg-gray-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" id="order-confirmation-error">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
        <p className="text-gray-600 mb-6">{error || "We couldn't locate this order in your account."}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/profile?tab=orders"
            className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
          >
            Go to My Orders
          </Link>
          <Link
            to="/"
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const addr = order.shippingAddress || {};
  const isPaid = order.paymentStatus === 'Paid';
  const mrp = Number(order.originalTotal || (order.totalPrice + (order.discountAmount || 0))) || order.totalPrice;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in-up" id="order-confirmation-page">
      {/* Hero Success Banner */}
      <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white rounded-3xl p-6 sm:p-10 shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 text-emerald-300 shadow-inner">
            <CheckCircle2 size={42} className="stroke-[2.5]" />
          </div>
          <span className="px-3.5 py-1 bg-white/20 backdrop-blur-md text-teal-100 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
            Order #{order._id.slice(-8)} Confirmed
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Thank you for your order!
          </h1>
          <p className="text-teal-100 text-sm sm:text-base max-w-lg">
            We've received your order and our fulfillment team is preparing it for shipment.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 bg-black/15 backdrop-blur-md px-4 py-2 rounded-xl text-xs sm:text-sm">
            <span className="text-teal-200">Order ID:</span>
            <code className="font-mono font-bold text-white tracking-wide">{order._id}</code>
            <button
              type="button"
              onClick={copyOrderId}
              aria-label="Copy order ID"
              className="ml-1 p-1 hover:bg-white/20 rounded transition-colors text-teal-200 hover:text-white"
              title="Copy Order ID"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 rounded-2xl flex items-center gap-3 border border-gray-100">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Estimated Delivery</p>
            <p className="text-sm font-bold text-gray-800">{calculateEstimatedDelivery(order.createdAt)}</p>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl flex items-center gap-3 border border-gray-100">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Order Status</p>
            <p className="text-sm font-bold text-gray-800">{order.status || 'Processing'}</p>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl flex items-center gap-3 border border-gray-100">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Payment Status</p>
            <p className="text-sm font-bold text-emerald-700">{isPaid ? 'Payment Verified' : 'Pending'}</p>
          </div>
        </Card>
      </div>

      {/* Main Content Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Items & Shipping Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card className="p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag size={18} className="text-teal-600" />
                Items Ordered ({(order.orderItems || []).length})
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {(order.orderItems || []).map((item, idx) => (
                <div key={`${item.productId || idx}`} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 border border-gray-200/60 overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/product/${item.productId}`}
                        className="text-sm font-bold text-gray-800 hover:text-teal-600 transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>Qty: {item.quantity}</span>
                        {(item.variantSize || item.variantColor) && (
                          <span>· {item.variantSize || ''} {item.variantColor || ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-500">{formatPrice(item.price)} each</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Delivery Address */}
          <Card className="p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-teal-600" />
              Delivery Details
            </h2>
            <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
              <p className="font-bold text-gray-900 text-sm">{addr.fullName || 'Customer'}</p>
              <p className="text-xs text-gray-600 mt-0.5">Phone: {addr.phone || 'N/A'}</p>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                {addr.street}, {addr.city}, {addr.state} - <span className="font-semibold text-gray-800">{addr.pinCode}</span>
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Financial Summary & Actions */}
        <div className="space-y-6">
          <Card className="p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-teal-600" />
              Payment Summary
            </h2>

            <div className="space-y-3 text-sm pb-4 border-b border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(mrp)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span>−{formatPrice(order.discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className="text-emerald-600 font-medium">Free</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="font-bold text-gray-900 text-base">Total Paid</span>
              <span className="font-extrabold text-teal-600 text-xl">{formatPrice(order.totalPrice)}</span>
            </div>

            <div className="mt-4 bg-teal-50/50 rounded-xl p-3 border border-teal-100/50">
              <div className="flex items-center justify-between text-xs text-teal-900">
                <span className="font-semibold">Payment Method</span>
                <span>Razorpay Secure</span>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex items-center justify-between text-[11px] text-teal-700/80 mt-1 font-mono">
                  <span>Ref:</span>
                  <span className="truncate max-w-[140px]">{order.razorpayPaymentId}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <Link
                to={`/track/${order._id}`}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all text-sm group"
              >
                <Truck size={18} />
                Track Delivery Live
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/profile?tab=orders"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm"
              >
                View in My Orders
              </Link>

              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-teal-600 hover:text-teal-700 font-semibold text-xs"
              >
                Continue Shopping
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
