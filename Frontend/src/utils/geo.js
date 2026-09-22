/**
 * Geo utilities — distance, bearing, ETA estimation.
 * Uses Haversine for great-circle distance (straight-line fallback; no routing
 * API key needed). ETA assumes a conservative courier speed.
 */

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in km between two [lat, lng] points. */
export function haversineKm(a, b) {
  if (!a || !b || !a.length || !b.length) return Infinity;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Straight-line distance in km between a location and a destination. */
export function distanceKm(fromPoint, toPoint) {
  return haversineKm(fromPoint, toPoint);
}

/**
 * ETA in speed-km/h — estimate minutes to reach destination.
 * Courier bikes typically avg 15-25 km/h in Indian metros.
 * Returns minutes (integer ≥ 2), or null when inputs are invalid.
 */
export function estimateMinutes(fromPoint, toPoint, { avgSpeedKmh = 20, minMinutes = 2 } = {}) {
  if (!fromPoint || !toPoint) return null;
  const km = haversineKm(fromPoint, toPoint);
  if (!Number.isFinite(km) || km === Infinity) return null;
  const minutes = Math.max(minMinutes, Math.round((km / avgSpeedKmh) * 60));
  return minutes;
}

/** Format minutes into a human label: "12 min" / "1 hr 5 min". */
export function formatEta(minutes) {
  if (minutes == null) return 'Estimating…';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Convert a timestamp string to locale time. */
export function timeLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Google Maps "open in maps" deep link for navigation. */
export function mapsDeepLink(lat, lng, { mode = 'd' } = {}) {
  return `https://www.google.com/maps/?q=${lat},${lng}&mode=${mode}`;
}

/**
 * Reverse-geocode a coordinate into address parts using the public Nominatim
 * (OpenStreetMap) API — no key required. Returns { street, city, state, pinCode,
 * displayName }. Throws on network/HTTP errors so callers can surface feedback.
 *
 * Nominatim usage policy: max ~1 request/second and a valid Referer. We only
 * call this on an explicit user action (confirm pin / use my location), never on
 * every drag frame.
 */
export async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  const a = data.address || {};
  const street =
    [a.house_number, a.road, a.suburb || a.neighbourhood || a.village]
      .filter(Boolean)
      .join(', ') ||
    data.display_name ||
    '';
  return {
    street,
    city: a.city || a.town || a.village || a.county || '',
    state: a.state || '',
    pinCode: a.postcode || '',
    displayName: data.display_name || '',
  };
}