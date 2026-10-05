import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, MapPin, Package, Truck, Home, Clock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/authContext';
import { fetchOrderById } from '../services/ordersApi';
import { MapContainer } from '../components/map/MapContainer';
import { useLiveTracking } from '../hooks/useLiveTracking';
import { distanceKm, estimateMinutes, formatEta, timeLabel, mapsDeepLink } from '../utils/geo';
import Card from '../components/ui/Card';
import { usePageTitle } from '../hooks/usePageTitle';

const DELIVERY_STEPS = [
  { key: 'assigned', label: 'Order assigned', icon: Package },
  { key: 'accepted', label: 'Courier accepted', icon: Truck },
  { key: 'picked_up', label: 'Picked up from store', icon: Home },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
];

const deliveryStepIndex = (status) => {
  const idx = DELIVERY_STEPS.findIndex((s) => s.key === status);
  return status === 'delivered' ? DELIVERY_STEPS.length - 1 : Math.max(0, idx);
};

function Timeline({ status, timestamps }) {
  const currentIdx = deliveryStepIndex(status);
  const endReached = status === 'delivered';
  return (
    <ol className="relative" aria-label="Delivery progress">
      {DELIVERY_STEPS.map((step, i) => {
        const StepIcon = step.icon;
        const done = endReached || i < currentIdx;
        const active = i === currentIdx && !endReached;
        const ts = timestamps && timestamps[step.key];
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {i < DELIVERY_STEPS.length - 1 && (
              <span
                className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? 'bg-teal-500' : 'bg-gray-200'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                done
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : active
                  ? 'bg-teal-50 border-teal-500 text-teal-600'
                  : 'bg-white border-gray-200 text-gray-300'
              }`}
              aria-hidden="true"
            >
              <StepIcon size={15} />
            </span>
            <div className="pt-1">
              <p className={`text-sm font-semibold ${done || active ? 'text-gray-800' : 'text-gray-500'}`}>{step.label}</p>
              {ts && done && <p className="text-xs text-gray-500">{timeLabel(ts)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function OrderTrackingPage() {
  usePageTitle('Track Order');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderError, setOrderError] = useState(null);
  // Separates "this order doesn't exist / no access" from a failed fetch so
  // only the recoverable case offers a retry.
  const [orderNotFound, setOrderNotFound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [mapKey, setMapKey] = useState(0);

  const { position, deliveryStatus, connected, error } = useLiveTracking(id, { enabled: true });

  // Load the order (must be the user's own order or admin)
  useEffect(() => {
    if (!id || authLoading || !user) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading while the order refetches
    setLoading(true);
    setOrderError(null);
    setOrderNotFound(false);
    const load = async () => {
      try {
        const res = await fetchOrderById(id);
        if (!cancelled && res.data) {
          setOrder(res.data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404 || err.response?.status === 403) {
          setOrderNotFound(true);
          setOrderError(err.response?.data?.message || 'Order not found or you do not have access.');
        } else {
          setOrderError('We could not reach the server to load this order. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, user, authLoading, retryKey]);

  const destination = useMemo(() => {
    const a = order?.shippingAddress;
    if (a && a.latitude != null && a.longitude != null) return [a.latitude, a.longitude];
    return null;
  }, [order]);

  const etaInfo = useMemo(() => {
    if (!position || !destination) return null;
    const km = distanceKm([position.latitude, position.longitude], destination);
    const minutes = estimateMinutes([position.latitude, position.longitude], destination);
    return { km, minutes, label: formatEta(minutes) };
  }, [position, destination]);

  const statusEffective = deliveryStatus || order?.deliveryStatus || 'not_assigned';
  const trackable = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'].includes(statusEffective);

  // Signed-out visitors used to sit behind an endless spinner here — give them
  // a real state (with a way out) instead. Derived at render time so the
  // effect never has to setState synchronously for the logged-out case.
  if (!authLoading && !user) {
    return (
      <div role="alert" className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Please sign in</h1>
        <p className="text-gray-500 mb-6">Sign in to track this order.</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="min-h-[44px] px-6 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate(-1)}
            className="min-h-[44px] px-4 font-semibold text-teal-600 hover:text-teal-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-600" size={36} aria-hidden="true" />
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div role="alert" className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {orderNotFound ? 'Order not found' : 'Order could not load'}
        </h1>
        <p className="text-gray-500 mb-6">{orderError}</p>
        <div className="flex items-center justify-center gap-4">
          {!orderNotFound && (
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="min-h-[44px] px-6 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="min-h-[44px] px-4 font-semibold text-teal-600 hover:text-teal-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const addr = order.shippingAddress || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-teal-600 mb-4 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Track Order</h1>
          <p className="text-sm text-gray-500 mt-1">
            Order <span className="text-teal-600 font-semibold">#{order.orderId || order._id.slice(-8)}</span>
            <span className="mx-2">·</span>
            <span className={`inline-flex items-center gap-1.5 font-semibold ${connected ? 'text-green-600' : 'text-amber-600'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} aria-hidden="true" />
              {connected ? 'Live' : error ? error : 'Updating…'}
            </span>
          </p>
        </div>
        <button
          onClick={() => setMapKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} aria-hidden="true" /> Reset map
        </button>
      </div>

      {!trackable && statusEffective !== 'delivered' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          This order has not started delivery yet. Live tracking begins once a courier picks it up.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Timeline + order summary */}
        <div className="space-y-6 min-w-0 order-2 lg:order-1">
          <Card className="rounded-2xl border p-5 sm:p-6">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Truck size={18} className="text-teal-600" aria-hidden="true" /> Delivery progress
            </h2>
            <Timeline
              status={statusEffective}
              timestamps={{
                assigned: order.assignedAt,
                accepted: order.acceptedAt,
                picked_up: order.pickedUpAt,
                out_for_delivery: order.outForDeliveryAt,
                delivered: order.deliveredAt,
              }}
            />
          </Card>

          <Card className="rounded-2xl border p-5 sm:p-6">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-teal-600" aria-hidden="true" /> Delivery address
            </h2>
            <p className="text-sm text-gray-600 font-semibold">{addr.fullName || 'Customer'}</p>
            <p className="text-sm text-gray-500">
              {[addr.street, addr.city, addr.state, addr.pinCode].filter(Boolean).join(', ')}
            </p>
            {destination && (
              <a
                href={mapsDeepLink(destination[0], destination[1])}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-teal-600 font-semibold hover:text-teal-700"
              >
                <Navigation size={14} aria-hidden="true" /> Open in Maps
              </a>
            )}
            {(order.orderItems || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <ul className="space-y-1">
                  {order.orderItems.slice(0, 5).map((item, i) => (
                    <li key={i} className="text-sm text-gray-600 flex justify-between gap-3">
                      <span className="truncate">{item.title} × {item.quantity}</span>
                      <span className="font-semibold shrink-0">₹{item.price * item.quantity}</span>
                    </li>
                  ))}
                  {order.orderItems.length > 5 && (
                    <li className="text-xs text-gray-500">+{order.orderItems.length - 5} more item(s)</li>
                  )}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Live map */}
        <div className="min-w-0 order-1 lg:order-2">
          <Card className="rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock size={16} className="text-teal-600" aria-hidden="true" /> Live status
              </h3>
              {etaInfo && trackable && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">ETA</p>
                  <p className="text-sm font-bold text-teal-700">{etaInfo.label}</p>
                </div>
              )}
            </div>
            <div className="h-72 sm:h-96 relative">
              <MapContainer
                key={mapKey}
                center={destination || [20.5937, 78.9629]}
                zoom={12}
                orderId={order._id}
                trackingMode="customer"
              />
            </div>
            {etaInfo && etaInfo.km < Infinity && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {position ? `Courier ${etaInfo.km.toFixed(1)} km away` : 'Awaiting courier position'}
                </span>
                {position && (
                  <span className="font-semibold text-gray-700">
                    Updated {timeLabel(position.updatedAt)}
                  </span>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default OrderTrackingPage;