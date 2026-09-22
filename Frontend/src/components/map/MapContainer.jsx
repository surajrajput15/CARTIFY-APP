import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Map, Marker, Polyline, divIcon } from './Map';
import useGPS from '../../hooks/useGPS';
import useSocket from '../../hooks/useSocket';

const ICONS = {
  // Courier/delivery van marker
  courier: divIcon(
    '<div class="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-lg border-2 border-white shadow-lg">🚚</div>'
  ),
  // Own position marker
  me: divIcon(
    '<div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg border-2 border-white shadow-lg">📍</div>'
  ),
  // Destination / home marker
  destination: divIcon(
    '<div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm border-2 border-white shadow-lg">🏠</div>'
  ),
};

/**
 * High-level MapContainer with live delivery tracking support.
 *
 * Props:
 *   center: [lat, lng] — destination / route endpoint
 *   zoom: number — initial zoom (default 13)
 *   orderId: string — order ID for live tracking
 *   trackingMode: 'courier' | 'customer' | 'admin'
 *     'courier'  — shows own GPS position, live-pings server (delivery partner)
 *     'customer' — shows the assigned courier's live position
 *     'admin'    — shows all supplied courier positions (orderId on payloads)
 *   couriers: array — for admin mode, list of { orderId, latitude, longitude, updatedAt }
 *   onLocationUpdate: (lat, lng) => void — called when own GPS updates
 *   showDestination: boolean — render the destination pin at center (default true)
 *   className, style
 */
export function MapContainer({
  center = [0, 0],
  zoom = 13,
  orderId,
  trackingMode = 'customer',
  couriers = [],
  onLocationUpdate,
  showDestination = true,
  className = '',
  style,
  ...rest
}) {
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);

  // GPS hook — active only in courier mode
  const {
    position: gpsPosition,
    error: gpsError,
    loading: gpsLoading,
    permission,
    start: startGPS,
    stop: stopGPS,
  } = useGPS({ throttleMs: 10000 });

  // Socket hook handles connect/auth/rooms/reconnection itself
  const { socket, connected, subscribe, unsubscribe, on, off } = useSocket();

  // Courier position state (from server)
  const [courierPosition, setCourierPosition] = useState(null);
  const [courierUpdatedAt, setCourierUpdatedAt] = useState(null);

  // Subscribe to the order room when connected
  useEffect(() => {
    if (!orderId || !connected) return;
    subscribe(orderId);
    return () => {
      unsubscribe(orderId);
    };
  }, [orderId, connected, subscribe, unsubscribe]);

  // Listen for live courier location updates
  useEffect(() => {
    if (!connected || trackingMode === 'courier') return;
    const handler = (payload) => {
      if (payload.orderId && payload.orderId !== orderId) return;
      if (payload.latitude != null && payload.longitude != null) {
        setCourierPosition([payload.latitude, payload.longitude]);
        setCourierUpdatedAt(payload.updatedAt);
      }
    };
    on('courier:location', handler);
    return () => off('courier:location', handler);
  }, [connected, trackingMode, orderId, on, off]);

  // Start/stop GPS in courier mode
  useEffect(() => {
    if (trackingMode === 'courier') startGPS();
    return () => stopGPS();
  }, [trackingMode, startGPS, stopGPS]);

  // Live-ping the server with own GPS every time it updates (courier mode)
  useEffect(() => {
    if (trackingMode !== 'courier' || !gpsPosition || !socket?.connected) return;
    socket.emit('courier:ping', {
      orderId,
      latitude: gpsPosition.latitude,
      longitude: gpsPosition.longitude,
    });
    if (onLocationUpdate) onLocationUpdate(gpsPosition.latitude, gpsPosition.longitude);
  }, [gpsPosition, orderId, trackingMode, socket, onLocationUpdate]);

  // In admin mode use the courriers prop; otherwise server-fed single courier
  const activeCouriers = useMemo(() => {
    if (trackingMode === 'admin') return couriers;
    if (courierPosition) return [{ position: courierPosition, updatedAt: courierUpdatedAt }];
    return [];
  }, [trackingMode, couriers, courierPosition, courierUpdatedAt]);

  // Map center: live courier position when available, else supplied center
  const mapCenter = useMemo(() => {
    if (activeCouriers.length === 1 && trackingMode !== 'courier') return activeCouriers[0].position;
    return center;
  }, [activeCouriers, trackingMode, center]);

  // Polyline between courier and destination (straight-line routing fallback)
  const hasRoute = useMemo(() => {
    if (trackingMode === 'courier') return gpsPosition && center && gpsPosition.latitude && gpsPosition.longitude;
    return activeCouriers.length === 1 && center && center[0];
  }, [trackingMode, gpsPosition, center, activeCouriers]);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  return (
    <div className={`relative ${className}`} style={{ ...style, height: '100%', width: '100%', minHeight: '300px' }} {...rest}>
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl border border-red-200 p-4 z-50">
          <div className="text-center text-red-600">
            <p className="font-medium">Map Error</p>
            <p className="text-sm text-gray-500 mt-1">{mapError}</p>
          </div>
        </div>
      )}

      <Map
        center={mapCenter}
        zoom={zoom}
        onMapReady={handleMapReady}
        className={className}
        style={style}
      >
        {/* Destination pin */}
        {showDestination && center[0] != null && center[1] != null && (
          <Marker position={center} icon={ICONS.destination} popup="Delivery destination" />
        )}

        {/* Courier markers (customer/admin view) */}
        {activeCouriers.map((c, i) => (
          <Marker
            key={i}
            position={c.position}
            icon={ICONS.courier}
            popup={c.updatedAt ? `Courier<br/>Updated: ${new Date(c.updatedAt).toLocaleTimeString()}` : 'Courier'}
          />
        ))}

        {/* Own GPS position (courier view) */}
        {trackingMode === 'courier' && gpsPosition && (
          <Marker
            position={[gpsPosition.latitude, gpsPosition.longitude]}
            icon={ICONS.me}
            popup={
              `Your location<br/>Accuracy: ±${Math.round(gpsPosition.accuracy || 0)}m<br/>` +
              `Updated: ${new Date(gpsPosition.timestamp).toLocaleTimeString()}`
            }
          />
        )}

        {/* Route polyline */}
        {hasRoute && (
          <Polyline
            positions={
              trackingMode === 'courier' && gpsPosition
                ? [[gpsPosition.latitude, gpsPosition.longitude], center]
                : ([activeCouriers[0]?.position, center])
            }
            color="#10b981"
            weight={3}
            opacity={0.7}
            dashArray="6, 10"
          />
        )}
      </Map>

      {/* Status overlay */}
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
            <span>{connected ? 'Live' : 'Connecting...'}</span>
            {trackingMode === 'courier' && (
              <>
                <span
                  className={`w-2 h-2 rounded-full ml-2 ${
                    gpsLoading ? 'bg-yellow-500 animate-pulse' : permission === 'granted' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xs">{gpsLoading ? 'GPS...' : permission === 'granted' ? 'GPS OK' : 'GPS Denied'}</span>
              </>
            )}
          </div>
          {courierUpdatedAt && (
            <p className="text-xs text-gray-500">Last courier update: {new Date(courierUpdatedAt).toLocaleTimeString()}</p>
          )}
          {gpsError && <p className="text-xs text-red-600 mt-1">{gpsError.message}</p>}
          {trackingMode === 'courier' && !gpsPosition && !gpsError && (
            <p className="text-xs text-gray-400 mt-1">Waiting for GPS fix…</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapContainer;