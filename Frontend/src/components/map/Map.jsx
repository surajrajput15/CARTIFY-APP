import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Leaflet Map wrapper with proper cleanup and error handling.
 *
 * Props:
 *   center: [lat, lng] — initial center
 *   zoom: number — initial zoom (default 13)
 *   children: ReactNode — Marker, Polyline, Popup, custom layers
 *   className: string — custom CSS class
 *   style: object — custom inline styles
 *   onMapReady: (map) => void — called when map is initialized
 *   options: object — additional Leaflet map options
 */
export function Map({
  center = [0, 0],
  zoom = 13,
  children,
  className = '',
  style,
  onMapReady,
  options = {},
  ...rest
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [ready, setReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true, // better performance for many markers
        ...options,
      });

      // OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
      setReady(true);

      if (onMapReady) onMapReady(map);
    } catch (err) {
      setMapError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mapError) {
    return (
      <div className={`relative ${className}`} style={{ ...style, minHeight: '300px' }} {...rest}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl border border-red-200 p-4">
          <div className="text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-600 font-medium">Map failed to load</p>
            <p className="text-sm text-gray-500 mt-1">{mapError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`relative ${className}`}
      style={{ ...style, height: '100%', width: '100%', minHeight: '300px' }}
      {...rest}
    >
      {ready ? <MapProvider mapInstanceRef={mapInstanceRef}>{children}</MapProvider> : null}
    </div>
  );;
}

/**
 * Fixes Leaflet's default marker icon path issue under bundlers (Vite/Rolldown,
 * webpack, etc.) where the marker images are not resolved automatically.
 */
export function defaultIcon() {
  if (L.Default.prototype.options.icon === undefined || L.Default.prototype.options.icon === null) {
    L.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }
  return new L.Icon.Default();
}

/**
 * Custom divIcon helper — renders an HTML string as the marker.
 * Use this to show emoji / custom colored pins without image assets.
 */
export function divIcon(html, { className = '', iconSize = [40, 40], iconAnchor = [20, 20], popupAnchor = [0, -20] } = {}) {
  return L.divIcon({ className: `leaflet-div-icon-no-border ${className}`, html, iconSize, iconAnchor, popupAnchor });
}

/**
 * Marker component — renders a Leaflet marker with optional popup.
 * position: [lat, lng]
 * icon: L.Icon instance (use defaultIcon() or divIcon()) — falls back to default
 * popup: string or React node string content for bindPopup
 */
export function Marker({ position, icon, popup, ...props }) {
  const markerRef = useRef(null);
  const mapRef = useMapContext();

  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || !position) return;

    const marker = L.marker(position, { icon: icon || defaultIcon(), ...props });
    markerRef.current = marker;
    marker.addTo(map);

    if (popup) {
      marker.bindPopup(popup);
    }

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [mapRef, position, icon, popup]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * Polyline component — draws a line between points.
 * positions: [[lat,lng], [lat,lng], ...]
 */
export function Polyline({ positions, color = '#10b981', weight = 4, opacity = 0.8, dashArray, ...props }) {
  const polylineRef = useRef(null);
  const mapRef = useMapContext();

  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || !positions || positions.length < 2) return;

    const polyline = L.polyline(positions, { color, weight, opacity, dashArray, ...props });
    polylineRef.current = polyline;
    polyline.addTo(map);

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [mapRef, positions, color, weight, opacity, dashArray]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * CircleMarker component — lightweight circle marker for accurate positions.
 * radius in meters/pixels (Leaflet circle defaults convert radius to meters when
 * using L.circle). Use for GPS accuracy visualization.
 */
export function Circle({ center, radius = 10, color = '#10b981', fillColor, fillOpacity = 0.2, weight = 2, ...props }) {
  const circleRef = useRef(null);
  const mapRef = useMapContext();

  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || !center) return;

    const circle = L.circle(center, { radius, color, fillColor: fillColor || color, fillOpacity, weight, ...props });
    circleRef.current = circle;
    circle.addTo(map);

    return () => {
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    };
  }, [mapRef, center, radius, color, fillColor, fillOpacity, weight]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * FitBounds component — fits map bounds to given positions.
 * positions: [[lat,lng], ...]
 * padding: [top, right, bottom, left] or number
 */
export function FitBounds({ positions, padding = [50, 50, 50, 50] }) {
  const mapRef = useMapContext();

  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || !positions || positions.length === 0) return;
    map.fitBounds(positions, { padding });
  }, [mapRef, positions, padding]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * Context to share the map instance (via ref) with child components.
 */
const MapContext = React.createContext(null);

function MapProvider({ children, mapInstanceRef }) {
  return <MapContext.Provider value={mapInstanceRef}>{children}</MapContext.Provider>;
}

function useMapContext() {
  const ctx = React.useContext(MapContext);
  if (!ctx) {
    throw new Error('Map components must be rendered within a Map component');
  }
  return ctx;
}

export default Map;