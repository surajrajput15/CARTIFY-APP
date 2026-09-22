import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, formatDate } from '../../utils/format';

const ORDER_STATUS_STYLES = {
  Pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
  Processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700' },
  Shipped: { label: 'Shipped', className: 'bg-indigo-50 text-indigo-700' },
  'Out for Delivery': { label: 'Out for Delivery', className: 'bg-orange-50 text-orange-700' },
  Delivered: { label: 'Delivered', className: 'bg-teal-50 text-teal-700' },
  Cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700' },
};

const OrdersTab = ({ orders, loading }) => {
  const [expandedId, setExpandedId] = useState(null);
  const getPaymentLabel = (status) => {
    if (status === 'Paid') return { label: 'Paid', className: 'bg-green-50 text-green-700' };
    return { label: 'Payment Pending', className: 'bg-yellow-50 text-yellow-700' };
  };

  const getOrderLabel = (status) =>
    ORDER_STATUS_STYLES[status] || { label: status || 'Unknown', className: 'bg-gray-100 text-gray-600' };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
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
                </div>
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-1">Items ({(order.orderItems || []).length})</p>
                      {(order.orderItems || []).map((item) => (
                        <p key={item.productId} className="text-sm text-gray-600">
                          {item.title} × {item.quantity} — {formatPrice(item.price * item.quantity)}
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
    </div>
  );
};

export default OrdersTab;
