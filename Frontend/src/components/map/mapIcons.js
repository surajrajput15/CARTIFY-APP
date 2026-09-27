import L from 'leaflet';

/**
 * Leaflet icon helpers shared by the Map wrapper and its consumers
 * (MapContainer, AdminDeliveryMap, LocationPicker).
 *
 * Kept out of Map.jsx so that file only exports components (fast refresh).
 */

/**
 * Fixes Leaflet's default marker icon path issue under bundlers (Vite/Rolldown,
 * webpack, etc.), where the marker images are not resolved automatically.
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
