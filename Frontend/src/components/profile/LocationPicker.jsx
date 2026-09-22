import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Map, Marker, divIcon } from '../map/Map';
import { reverseGeocode } from '../../utils/geo';

const DEFAULT_CENTER = [20.5937, 78.9629];

const PIN_ICON = divIcon(
  '<div class="w-9 h-9 bg-teal-600 rounded-full flex items-center justify-center text-base border-2 border-white shadow-lg">📍</div>',
  { iconSize: [36, 36], iconAnchor: [18, 36] }
);

const isCoord = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);

/**
 * Draggable/clickable map pin picker for saving a delivery address location.
 *
 * Props:
 *   latitude, longitude — current pin (numbers) or null
 *   onPick({ latitude, longitude }) — called whenever the pin moves
 *   onAddressResolved({ street, city, state, pinCode }) — called after a
 *     successful reverse-geocode of the confirmed pin
 */
export default function LocationPicker({ latitude, longitude, onPick, onAddressResolved }) {
  const mapInstanceRef = useRef(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const hasInitial = isCoord(Number(latitude), Number(longitude));
  const [pin, setPin] = useState(hasInitial ? [Number(latitude), Number(longitude)] : null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const setPoint = useCallback((lat, lng) => {
    setPin([lat, lng]);
    onPickRef.current?.({ latitude: lat, longitude: lng });
  }, []);

  const handleMapReady = useCallback(
    (map) => {
      mapInstanceRef.current = map;
      map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng));
    },
    [setPoint]
  );

  // Re-center + re-pin when an address is loaded for editing.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isCoord(lat, lng)) {
      setPin([lat, lng]);
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [latitude, longitude]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPoint(pos.coords.latitude, pos.coords.longitude);
        mapInstanceRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 16);
      },
      () => {
        setLocating(false);
        toast.error('Unable to get your location. Drop a pin on the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmPin = async () => {
    if (!pin) {
      toast.error('Tap the map to drop a pin first');
      return;
    }
    setGeocoding(true);
    try {
      const result = await reverseGeocode(pin[0], pin[1]);
      onAddressResolved?.(result);
      toast.success('Address filled from map');
    } catch {
      toast.error('Could not look up that address. Fill it in manually.');
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="md:col-span-2">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 min-h-[44px]"
        >
          {locating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
          Use my location
        </button>
        <button
          type="button"
          onClick={confirmPin}
          disabled={geocoding || !pin}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 min-h-[44px]"
        >
          {geocoding ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
          Confirm pin &amp; fill address
        </button>
        {pin && (
          <span className="text-xs text-gray-500">
            {pin[0].toFixed(5)}, {pin[1].toFixed(5)}
          </span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '260px' }}>
        <Map
          center={pin || DEFAULT_CENTER}
          zoom={pin ? 15 : 5}
          onMapReady={handleMapReady}
          style={{ height: '100%', width: '100%' }}
        >
          {pin && <Marker position={pin} icon={PIN_ICON} />}
        </Map>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Tap anywhere on the map to drop a pin, then confirm to auto-fill the address fields. The pin is optional.
      </p>
    </div>
  );
}
