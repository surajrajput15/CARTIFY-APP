import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapPin, Navigation, RefreshCw, Truck, Package, Users, Loader2 } from 'lucide-react';
import { Map, Marker, Polyline, FitBounds, divIcon } from '../map/Map';
import { fetchAdminDeliveryOrders } from '../../services/deliveryApi';
import useSocket from '../../hooks/useSocket';
import { mapsDeepLink } from '../../utils/geo';

const ACTIVE_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

const COURIER_ICON = divIcon(
  '<div style="width:36px;height:36px;background:#0d9488;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 8px rgba(0,0,0,.25)">🚚</div>'
);
const DEST_ICON = divIcon(
  '<div style="width:30px;height:30px;background:#dc2626;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.25)">🏠</div>'
);

const STATUS_COLOR = {
  assigned: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  picked_up: 'bg-violet-100 text-violet-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
};

function AdminDeliveryMap() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [livePositions, setLivePositions] = useState({});
  const { connected, socket } = useSocket();
  const dataRef = useRef(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminDeliveryOrders({ limit: 50 });
      setOrders(res.data.orders || []);
    } catch {
      toast.error('Failed to load delivery orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Live courier:location events update the map + list in realtime
  useEffect(() => {
    if (!connected) return;
    dataRef.current = livePositions;
    const handler = (payload) => {
      if (payload.partnerId && payload.latitude != null && payload.longitude != null) {
        setLivePositions((prev) => ({
          ...prev,
          [payload.partnerId]: { latitude: payload.latitude, longitude: payload.longitude, updatedAt: payload.updatedAt },
        }));
      }
    };
    socket.on('courier:location', handler);
    return () => {
      socket.off('courier:location', handler);
    };
  }, [connected, socket]);

  // Derive active deliveries with live courier position where available
  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.includes(o.deliveryStatus))
      .map((o) => ({
        ...o,
        livePos: o.deliveryPartnerId ? livePositions[o.deliveryPartnerId._id || o.deliveryPartnerId] : null,
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [orders, livePositions]);

  const badgePoints = useMemo(() => {
    const pts = [];
    activeOrders.forEach((o) => {
      if (o.livePos) pts.push([o.livePos.latitude, o.livePos.longitude]);
      const a = o.shippingAddress;
      if (a?.latitude != null && a?.longitude != null) pts.push([a.latitude, a.longitude]);
    });
    return pts;
  }, [activeOrders]);

  const prepared = useMemo(() => {
    const features = [];
    activeOrders.forEach((o) => {
      const a = o.shippingAddress || {};
      const dest = a.latitude != null && a.longitude != null ? [a.latitude, a.longitude] : null;
      if (o.livePos && dest) {
        features.push({ type: 'route', orderId: o._id, from: [o.livePos.latitude, o.livePos.longitude], to: dest });
      }
      if (o.livePos) {
        features.push({ type: 'courier', orderId: o._id, position: [o.livePos.latitude, o.livePos.longitude], partnerName: o.deliveryPartnerId?.name, ts: o.livePos.updatedAt });
      }
      if (dest) {
        features.push({ type: 'dest', orderId: o._id, position: dest });
      }
    });
    return features;
  }, [activeOrders]);

  const selected = useMemo(
    () => activeOrders.find((o) => o._id === selectedOrderId) || null,
    [activeOrders, selectedOrderId]
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
            <Truck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-gray-800">Live Delivery Map</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
              {connected ? `${activeOrders.length} active` : 'Connecting to live feed…'}
            </p>
          </div>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Orders list */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 max-h-[560px] overflow-y-auto">
          <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Package size={15} className="text-teal-600" aria-hidden="true" /> Active deliveries
          </h3>
          {loading && activeOrders.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-600" size={22} aria-hidden="true" /></div>
          ) : activeOrders.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No active deliveries right now.</p>
          ) : (
            <div className="space-y-2">
              {activeOrders.map((o) => {
                const meta = STATUS_COLOR[o.deliveryStatus] || STATUS_COLOR.assigned;
                const a = o.shippingAddress || {};
                return (
                  <button
                    key={o._id}
                    onClick={() => setSelectedOrderId(o._id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedOrderId === o._id ? 'border-teal-500 bg-teal-50/60' : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-800 text-sm truncate">#{o.orderId || o._id.slice(-8)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta}`}>
                        {STATUS_COLOR[o.deliveryStatus] && o.deliveryStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 truncate">
                      {o.livePos ? (
                        <><Truck size={11} className="text-teal-600" aria-hidden="true" /> {o.deliveryPartnerId?.name || 'Courier'} live</>
                      ) : (
                        <><Users size={11} className="text-gray-400" aria-hidden="true" /> {o.deliveryPartnerId?.name || 'No GPS yet'}</>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <MapPin size={15} className="text-teal-600" aria-hidden="true" />
              {selected ? `Order #${selected.orderId || selected._id.slice(-8)}` : 'All active couriers'}
            </h3>
            {selected?.shippingAddress?.latitude != null && selected?.shippingAddress?.longitude != null && (
              <a
                href={mapsDeepLink(selected.shippingAddress.latitude, selected.shippingAddress.longitude)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg"
              >
                <Navigation size={13} aria-hidden="true" /> Navigate
              </a>
            )}
          </div>
          <div className="h-96 sm:h-[480px] relative">
            <Map center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
              {prepared.map((f, i) =>
                f.type === 'route' ? (
                  <Polyline key={`r-${i}`} positions={[f.from, f.to]} color={selectedOrderId === f.orderId ? '#0d9488' : '#94a3b8'} weight={3} opacity={0.8} dashArray="6, 8" />
                ) : f.type === 'courier' ? (
                  <Marker
                    key={`c-${i}`}
                    position={f.position}
                    icon={COURIER_ICON}
                    popup={f.partnerName ? `Courier: ${f.partnerName}` : 'Courier'}
                  />
                ) : (
                  <Marker key={`d-${i}`} position={f.position} icon={DEST_ICON} popup="Delivery destination" />
                )
              )}
              {badgePoints.length > 0 && <FitBounds positions={badgePoints} padding={[60, 60, 60, 60]} />}
            </Map>
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl shadow p-3 text-xs text-gray-600 z-50 max-w-[220px]">
              <p className="flex items-center gap-1.5 font-semibold mb-1"><Truck size={12} className="text-teal-600" aria-hidden="true" /> Courier</p>
              <p className="flex items-center gap-1.5"><MapPin size={12} className="text-red-600" aria-hidden="true" /> Destination</p>
              {connected && <p className="mt-1 text-green-600 font-semibold">● LIVE</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDeliveryMap;