import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatDate } from '../../utils/format';
import { cancelOrder } from '../../services/ordersApi';
import Card from '../ui/Card';
import ConfirmModal from '../ConfirmModal';

const CANCELLABLE_STATUSES = ['Pending', 'Confirmed', 'Processing'];

const ORDER_STATUS_STYLES = {
  Pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
  Processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700' },
  Shipped: { label: 'Shipped', className: 'bg-indigo-50 text-indigo-700' },
  'Out for Delivery': { label: 'Out for Delivery', className: 'bg-orange-50 text-orange-700' },
  Delivered: { label: 'Delivered', className: 'bg-teal-50 text-teal-700' },
  Cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700' },
};

// F-16: happy-path lifecycle shown in the detail timeline — same forward-only
// order as Backend/routes/orderRoutes.js ALLOWED_TRANSITIONS.
const STATUS_STEPS = ['Pending', 'Processing', 'Shipped', 'Delivered'];

const OrdersTab = ({ orders, loading, error, onRetry }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    setCancelling(true);
    try {
      await cancelOrder(orderToCancel._id);
      toast.success('Order cancelled successfully');
      setOrderToCancel(null);
      if (onRetry) {
        onRetry();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const getPaymentLabel = (status) => {
    if (status === 'Paid') return { label: 'Paid', className: 'bg-green-50 text-green-700' };
    return { label: 'Payment Pending', className: 'bg-yellow-50 text-yellow-700' };
  };

  const getOrderLabel = (status) =>
    ORDER_STATUS_STYLES[status] || { label: status || 'Unknown', className: 'bg-gray-100 text-gray-600' };

  return (
    <Card className="rounded-2xl border p-6 sm:p-8 animate-fade-in-up">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">Recent Orders</h2>
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <div className="h-4 w-40 bg-gray-200 rounded mb-3"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="text-center py-8 px-4">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-700 font-bold mb-1">Orders could not load</p>
          <p className="text-gray-500 text-sm mb-4">We couldn't reach the server. Your orders are safe — try again.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[44px] px-6 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">Your order history will appear here once you make a purchase.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const payment = getPaymentLabel(order.paymentStatus);
            const orderStatus = getOrderLabel(order.status);
            const expanded = expandedId === order._id;
            const addr = order.shippingAddress || {};
            return (
              <div key={order._id} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-bold">Order ID: #{order._id.slice(-8)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${payment.className}`}>{payment.label}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${orderStatus.className}`}>{orderStatus.label}</span>
                  </div>
                </div>
                {order.discountAmount > 0 ? (
                  <div className="text-sm">
                    {(() => {
                      const mrp = Number(order.originalTotal || (order.totalPrice + order.discountAmount)) || 0;
                      return mrp > 0 ? (
                        <p className="text-gray-500 line-through">MRP: {formatPrice(mrp)}</p>
                      ) : null;
                    })()}
                    <p className="text-green-700 font-bold">Discount {order.couponCode ? `(${order.couponCode})` : ''}: −{formatPrice(order.discountAmount)}</p>
                    <p className="text-teal-600 font-bold">Paid: {formatPrice(order.totalPrice)}</p>
                  </div>
                ) : (
                  <p className="text-teal-600 font-bold">Total: {formatPrice(order.totalPrice)}</p>
                )}
                {order.paidAt && (
                  <p className="text-gray-500 text-xs mt-1">Paid on {formatDate(order.paidAt)}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : order._id)}
                    aria-expanded={expanded}
                    className="text-sm font-bold text-teal-600 hover:text-teal-700"
                  >
                    {expanded ? 'Hide details' : 'View details'}
                  </button>
                  {(order.deliveryStatus === 'out_for_delivery' || order.deliveryStatus === 'accepted' || order.deliveryStatus === 'picked_up' || order.deliveryStatus === 'assigned' || order.deliveryStatus === 'delivered') && (
                    <Link
                      to={`/track/${order._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Track Delivery
                    </Link>
                  )}
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => setOrderToCancel(order)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-2">Status timeline</p>
                      {order.status === 'Cancelled' ? (
                        <p className="text-sm font-bold text-red-600">This order was cancelled.</p>
                      ) : (
                        <ol className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Order status timeline">
                          {STATUS_STEPS.map((step, i) => {
                            const currentIndex = STATUS_STEPS.indexOf(order.status);
                            const done = currentIndex >= 0 && i < currentIndex;
                            const current = i === currentIndex;
                            return (
                              <li
                                key={step}
                                aria-current={current ? 'step' : undefined}
                                className="flex items-center gap-1.5 text-xs font-bold"
                              >
                                <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${done || current ? 'bg-teal-600' : 'bg-gray-300'}`} />
                                <span className={done ? 'text-teal-700' : current ? 'text-gray-900' : 'text-gray-500'}>
                                  {step}{done ? ' ✓' : current ? ' (now)' : ''}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-1">Items ({(order.orderItems || []).length})</p>
                      {(order.orderItems || []).map((item, i) => (
                        <p key={`${item.productId || item._id || item.title || 'item'}-${i}`} className="text-sm text-gray-600">
                          {item.productId ? (
                            <Link
                              to={`/product/${item.productId}`}
                              className="font-bold text-teal-600 hover:text-teal-700 hover:underline"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )} × {item.quantity} — {formatPrice(item.price * item.quantity)}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-1">Shipping address</p>
                      <p className="text-sm text-gray-600">
                        {addr.fullName} · {addr.phone}
                        <br />
                        {addr.street}, {addr.city}, {addr.state} - {addr.pinCode}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {orderToCancel && (
        <ConfirmModal
          title="Cancel Order"
          message={`Are you sure you want to cancel order #${orderToCancel._id.slice(-8)}? Any reserved items will be released back to inventory.`}
          confirmLabel="Yes, Cancel Order"
          cancelLabel="Keep Order"
          loading={cancelling}
          onCancel={() => setOrderToCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </Card>
  );
};

export default OrdersTab;
