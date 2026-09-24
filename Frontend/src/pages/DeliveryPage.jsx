import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Package, Phone, MapPin, Navigation, XCircle, Clock, ChevronDown, AlertTriangle, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/authContext';
import {
  fetchDeliveryStats,
  fetchAssignedDeliveries,
  fetchCompletedDeliveries,
  fetchFailedDeliveries,
  acceptDelivery,
  pickupDelivery,
  outForDelivery,
  completeDelivery,
  failDelivery,
} from '../services/deliveryApi';
import { MapContainer } from '../components/map/MapContainer';
import useSocket from '../hooks/useSocket';

const STATUS_STEPS = ['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered'];

const STATUS_META = {
  assigned: { label: 'Assigned', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  accepted: { label: 'Accepted', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  picked_up: { label: 'Picked Up', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-200' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200' },
};

const NEXT_ACTIONS = {
  assigned: { label: 'Accept Delivery', fn: acceptDelivery, next: 'accepted' },
  accepted: { label: 'Pick Up Order', fn: pickupDelivery, next: 'picked_up' },
  picked_up: { label: 'Start Delivery', fn: outForDelivery, next: 'out_for_delivery' },
  out_for_delivery: { label: 'Mark Delivered', fn: completeDelivery, next: 'delivered' },
};

const googleMapsLink = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

const formatMoney = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
};

const DELIVERY_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function OrderCard({ order, onAction, loadingOrderId }) {
  const addr = order.shippingAddress || {};
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[order.deliveryStatus] || STATUS_META.assigned;
  const action = NEXT_ACTIONS[order.deliveryStatus];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-gray-800 truncate">
                Order <span className="text-teal-600">#{order.orderId || order._id?.slice(-8)}</span>
              </p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {order.orderItems?.length} item{order.orderItems?.length !== 1 ? 's' : ''} ·{' '}
              {formatMoney(order.totalPrice)} ·{' '}
              <span className={order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-amber-600'}>
                {order.paymentStatus}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {action && (
              <button
                onClick={() => onAction(order, action)}
                disabled={loadingOrderId === order._id}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingOrderId === order._id ? 'Updating...' : action.label}
              </button>
            )}
            {order.deliveryStatus !== 'delivered' && order.deliveryStatus !== 'failed' && (
              <button
                onClick={() => onAction(order, { label: 'Mark Failed', fn: failDelivery, next: 'failed' })}
                disabled={loadingOrderId === order._id}
                className="px-3 py-1.5 sm:px-3 sm:py-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                title="Mark delivery as failed"
              >
                <XCircle size={16} aria-hidden="true" />
              </button>
            )}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Delivery progress */}
        <div className="mt-4 flex items-center gap-1.5">
          {STATUS_STEPS.filter((s) => s !== 'delivered').map((step, i) => {
            const stepIdx = STATUS_STEPS.indexOf(order.deliveryStatus);
            const reached = i <= stepIdx;
            const label = STATUS_META[step].label;
            return (
              <div key={step} className="flex items-center gap-1.5 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      reached ? 'bg-teal-600 border-teal-600' : 'bg-gray-200 border-gray-300'
                    }`}
                    aria-hidden="true"
                  />
                  <span className={`text-[10px] mt-1 whitespace-nowrap ${reached ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 2 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${i < stepIdx ? 'bg-teal-600' : 'bg-gray-200'}`} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Delivery Address</h4>
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <MapPin size={16} className="text-teal-600 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{addr.fullName || 'Customer'}</p>
                  <p className="text-gray-500">{[addr.street, addr.city, addr.state, addr.pinCode].filter(Boolean).join(', ')}</p>
                  {addr.phone && (
                    <p className="flex items-center gap-1 text-gray-500 mt-0.5">
                      <Phone size={13} className="text-teal-600" aria-hidden="true" /> {addr.phone}
                    </p>
                  )}
                  {addr.latitude != null && addr.longitude != null && (
                    <a
                      href={googleMapsLink(addr.latitude, addr.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-teal-600 font-semibold mt-2 hover:text-teal-700"
                    >
                      <Navigation size={14} aria-hidden="true" /> Navigate
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Items</h4>
              <ul className="space-y-1.5">
                {(order.orderItems || []).map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-700 truncate">
                      {item.title} <span className="text-gray-400">× {item.quantity}</span>
                    </span>
                    <span className="font-semibold text-gray-800 shrink-0">{formatMoney(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock size={12} aria-hidden="true" /> Placed {timeAgo(order.createdAt)}</span>
            {order.acceptedAt && <span>Accepted {timeAgo(order.acceptedAt)}</span>}
            {order.pickedUpAt && <span>Picked up {timeAgo(order.pickedUpAt)}</span>}
            {order.outForDeliveryAt && <span>Out for delivery {timeAgo(order.outForDeliveryAt)}</span>}
            {order.deliveredAt && <span>Delivered {timeAgo(order.deliveredAt)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryMap({ order }) {
  const addr = order.shippingAddress || {};
  const destination = addr.latitude != null && addr.longitude != null ? [addr.latitude, addr.longitude] : null;

  if (!destination) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 inline-flex items-center gap-2">
          <AlertTriangle size={16} aria-hidden="true" />
          Live map needs destination coordinates — update the address with a pin for GPS navigation.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <MapPin size={18} className="text-teal-600" aria-hidden="true" /> Live Route
        </h3>
        <a
          href={googleMapsLink(destination[0], destination[1])}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <Navigation size={15} aria-hidden="true" /> Open in Maps
        </a>
      </div>
      <div className="h-72 sm:h-96">
        <MapContainer
          center={destination}
          zoom={14}
          trackingMode="courier"
          orderId={order._id}
        />
      </div>
    </div>
  );
}

function DeliveryPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stats, setStats] = useState(null);
  const { connected } = useSocket();

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchDeliveryStats();
      setStats(res.data);
    } catch {
      // Stats are a nice-to-have — never block the dashboard on them.
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const fetchers = {
    active: fetchAssignedDeliveries,
    completed: fetchCompletedDeliveries,
    failed: fetchFailedDeliveries,
  };

  const loadOrders = useCallback(
    async (which = tab, pg = 1) => {
      setLoading(true);
      try {
        const res = await fetchers[which](pg, 20);
        const data = res.data;
        setOrders(data.orders || []);
        setTotalPages(data.pages || 1);
        setPage(data.page || 1);
        if (data.orders?.length && !selectedOrder) {
          setSelectedOrder(data.orders[0]);
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load deliveries');
      } finally {
        setLoading(false);
      }
    },
    [tab] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    loadOrders(tab, 1);
  }, [tab, loadOrders]);

  const handleAction = async (order, action) => {
    setLoadingOrderId(order._id);
    try {
      const res = await action.fn(order._id);
      toast.success(`Delivery ${action.label.toLowerCase()}`);
      const updated = res.data.order;
      setOrders((prev) => prev.map((o) => (o._id === order._id ? updated : o)));
      setSelectedOrder((s) => (s && s._id === order._id ? updated : s));
      if (action.next === 'delivered' || action.next === 'failed') {
        loadOrders(tab, page);
        loadStats();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setLoadingOrderId(null);
    }
  };

  const selected = useMemo(
    () => (selectedOrder ? orders.find((o) => o._id === selectedOrder._id) || selectedOrder : null),
    [selectedOrder, orders]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Delivery Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.name} · {user?.phone || 'Delivery partner'}
            <span className="mx-2">·</span>
            <span className={`inline-flex items-center gap-1.5 font-semibold ${connected ? 'text-green-600' : 'text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-semibold text-gray-600 transition-colors"
          >
            <UserCircle2 size={16} aria-hidden="true" /> Profile &amp; Settings
          </Link>
          <button
            onClick={() => loadOrders(tab, 1)}
            disabled={loading}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-semibold text-gray-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Dashboard stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0" aria-hidden="true">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-none">{stats.active}</p>
              <p className="text-xs text-gray-500 mt-1">Active deliveries</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0" aria-hidden="true">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-none">{stats.todayCompleted}</p>
              <p className="text-xs text-gray-500 mt-1">Delivered today</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0" aria-hidden="true">
              <XCircle size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-none">{stats.todayFailed}</p>
              <p className="text-xs text-gray-500 mt-1">Failed today</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0" aria-hidden="true">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-none">{stats.weekCompleted}</p>
              <p className="text-xs text-gray-500 mt-1">Delivered (7 days)</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {DELIVERY_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTab(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              tab === opt.value ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && !orders.length ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order list */}
          <div className="space-y-4 min-w-0">
            {orders.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <Package size={40} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
                <p className="font-semibold text-gray-600">No {tab} deliveries</p>
                <p className="text-sm text-gray-400 mt-1">New assignments will appear here automatically.</p>
              </div>
            )}

            {orders.map((order) => (
              <div key={order._id} onClick={() => setSelectedOrder(order)} onKeyDown={() => setSelectedOrder(order)} role="button" tabIndex={0}>
                <OrderCard order={order} onAction={handleAction} loadingOrderId={loadingOrderId} />
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => loadOrders(tab, page - 1)}
                  disabled={page <= 1 || loading}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => loadOrders(tab, page + 1)}
                  disabled={page >= totalPages || loading}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Map / details panel */}
          <div className="min-w-0 space-y-4">
            {selected ? (
              <>
                <DeliveryMap order={selected} />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <OrderCard order={selected} onAction={handleAction} loadingOrderId={loadingOrderId} />
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center h-full min-h-72 flex flex-col items-center justify-center">
                <MapPin size={40} className="text-gray-300 mb-3" aria-hidden="true" />
                <p className="font-semibold text-gray-600">Select an order to view its live route</p>
                <p className="text-sm text-gray-400 mt-1">Choose a delivery from the list to load the map.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryPage;