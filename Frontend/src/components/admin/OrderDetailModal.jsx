import { useEffect, useState } from 'react';
import {
  X,
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { formatPrice, formatDate } from '../../utils/format';
import { nextStatuses } from '../../utils/orderTransitions';
import ConfirmModal from '../ConfirmModal';

const paymentBadge = (status) => {
  switch (status) {
    case 'Paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Refunded': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const statusBadge = (status) => {
  switch (status) {
    case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Shipped':
    case 'Out for Delivery': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Processing':
    case 'Packed':
    case 'Confirmed': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Cancelled':
    case 'Failed': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const OrderDetailModal = ({
  order,
  isOpen,
  onClose,
  onStatusChange,
  onRefund,
  isUpdating = false
}) => {
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !refundConfirmOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, refundConfirmOpen, onClose]);

  if (!isOpen || !order) return null;

  const orderId = order._id ? String(order._id) : '';
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : 'UNKNOWN';
  const customer = order.userId || {};
  const shipping = order.shippingAddress || {};
  const items = order.orderItems || [];
  const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

  // Delivery partner details
  const courier = order.deliveryPartnerId;

  // Milestone timeline calculation
  const timeline = [
    { title: 'Order Placed', time: order.createdAt, done: true },
    { title: 'Payment Confirmed', time: order.paidAt || (order.paymentStatus === 'Paid' ? order.createdAt : null), done: order.paymentStatus === 'Paid' || order.paidAt },
    { title: 'Courier Assigned', time: order.assignedAt, done: Boolean(order.assignedAt || (order.deliveryStatus && order.deliveryStatus !== 'not_assigned')) },
    { title: 'Out for Delivery', time: order.pickedUpAt, done: ['out_for_delivery', 'delivered'].includes(order.deliveryStatus) || ['Out for Delivery', 'Delivered'].includes(order.status) },
    { title: 'Delivered', time: order.deliveredAt, done: order.deliveryStatus === 'delivered' || order.status === 'Delivered' }
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/60 backdrop-blur-sm overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-order-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !refundConfirmOpen) onClose();
        }}
      >
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 my-auto overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-b border-gray-100 bg-gray-50/80">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded">
                  #{shortId}
                </span>
                <h2 id="modal-order-title" className="text-lg font-bold text-gray-900">
                  Order Operations Manifest
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-400" /> Placed on {formatDate(order.createdAt)} • Full ID: {orderId}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge(order.status)}`}>
                {order.status}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${paymentBadge(order.paymentStatus)}`}>
                {order.paymentStatus}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close order details"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors ml-2"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Operational Warnings / Banners */}
          {order.stockShortfall && (
            <div className="mx-6 mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <ShieldAlert className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-rose-800">
                  Fulfillment Stock Shortfall Detected
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Payment was captured for this order, but one or more items ran out of stock concurrently during checkout. The customer has been alerted and an operational refund should be processed if stock cannot be allocated.
                </p>
              </div>
            </div>
          )}

          <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-6">
            {/* Top Grid: Customer, Shipping, Financials */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  <User size={14} className="text-teal-600" /> Customer Account
                </div>
                <p className="text-sm font-semibold text-gray-900">{customer.name || shipping.fullName || 'Guest / Direct'}</p>
                <p className="text-xs text-gray-600 mt-0.5 break-all">{customer.email || 'No email provided'}</p>
                <p className="text-xs text-gray-600 mt-0.5">{shipping.phone || customer.phone || 'No phone provided'}</p>
              </div>

              {/* Shipping Address */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  <MapPin size={14} className="text-teal-600" /> Delivery Destination
                </div>
                <p className="text-xs font-medium text-gray-800">{shipping.street || 'Address not recorded'}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {[shipping.city, shipping.state, shipping.pinCode].filter(Boolean).join(', ') || '—'}
                </p>
                {shipping.latitude && shipping.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${shipping.latitude},${shipping.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-800 mt-2"
                  >
                    Open Coordinates <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Payment Details */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  <CreditCard size={14} className="text-teal-600" /> Payment & Settlement
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-gray-500">Gross Total</span>
                  <span className="text-base font-extrabold text-gray-900">{formatPrice(order.totalPrice ?? 0)}</span>
                </div>
                {order.couponCode && (
                  <div className="flex justify-between text-xs text-teal-700 font-medium">
                    <span>Coupon: {order.couponCode}</span>
                    <span>Applied</span>
                  </div>
                )}
                {order.razorpayPaymentId && (
                  <p className="text-[11px] font-mono text-gray-500 mt-1 truncate" title={order.razorpayPaymentId}>
                    Pay ID: {order.razorpayPaymentId}
                  </p>
                )}
                {order.refundId && (
                  <p className="text-[11px] font-mono text-amber-700 mt-0.5 truncate" title={order.refundId}>
                    Refund ID: {order.refundId}
                  </p>
                )}
              </div>
            </div>

            {/* Courier & Milestone Timeline */}
            <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-teal-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Fulfillment & Delivery Pipeline
                  </span>
                </div>
                <div className="text-xs font-medium text-gray-600">
                  Status: <span className="font-bold capitalize">{order.deliveryStatus ? order.deliveryStatus.replace(/_/g, ' ') : 'Not Assigned'}</span>
                  {courier && (
                    <span className="ml-2 text-gray-500">
                      • Partner: <strong className="text-gray-800">{courier.name}</strong> ({courier.phone || courier.email})
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Milestones */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {timeline.map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-2 rounded-lg bg-gray-50">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1.5 ${
                      step.done ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {step.done ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </div>
                    <span className="text-[11px] font-bold text-gray-800">{step.title}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {step.time ? formatDate(step.time) : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Manifest */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                  <Package size={15} className="text-teal-600" />
                  Order Items Manifest ({totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'} across {items.length} {items.length === 1 ? 'Product' : 'Products'})
                </h3>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                    <tr>
                      <th className="text-left p-3 font-semibold">Item Specification</th>
                      <th className="text-left p-3 font-semibold">Variant Details</th>
                      <th className="text-center p-3 font-semibold">Qty</th>
                      <th className="text-right p-3 font-semibold">Unit Price</th>
                      <th className="text-right p-3 font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, i) => {
                      const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="p-3">
                            <span className="font-semibold text-gray-800 block text-xs">{item.title}</span>
                            <span className="text-[10px] font-mono text-gray-400">SKU/ID: {item.productId ? String(item.productId).slice(-6).toUpperCase() : 'N/A'}</span>
                          </td>
                          <td className="p-3 text-gray-600">
                            {item.variantSize || item.variantColor ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.variantSize && (
                                  <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Size: {item.variantSize}
                                  </span>
                                )}
                                {item.variantColor && (
                                  <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Color: {item.variantColor}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Standard / None</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-700">{item.quantity || 1}</td>
                          <td className="p-3 text-right text-gray-600">{formatPrice(item.price || 0)}</td>
                          <td className="p-3 text-right font-bold text-gray-900">{formatPrice(itemTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Operational Controls Footer */}
          <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">Transition Status:</span>
              <select
                value={order.status}
                disabled={isUpdating || nextStatuses(order.status).length === 1}
                onChange={(e) => onStatusChange(order._id, e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-800 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 min-h-[38px] bg-white"
                aria-label="Transition order status"
              >
                {nextStatuses(order.status).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {order.paymentStatus === 'Paid' && (
                <button
                  type="button"
                  onClick={() => setRefundConfirmOpen(true)}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 min-h-[38px]"
                >
                  <RotateCcw size={14} /> Process Razorpay Refund
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors min-h-[38px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {refundConfirmOpen && (
        <ConfirmModal
          title="Confirm Operational Refund"
          message={`Initiate a full Razorpay refund of ${formatPrice(order.totalPrice || 0)} for order #${shortId}? This will automatically transition the order status to Cancelled and mark payment as Refunded.`}
          confirmLabel="Execute Refund"
          loading={isUpdating}
          onConfirm={() => {
            setRefundConfirmOpen(false);
            onRefund(order);
          }}
          onCancel={() => setRefundConfirmOpen(false)}
        />
      )}
    </>
  );
};

export default OrderDetailModal;
