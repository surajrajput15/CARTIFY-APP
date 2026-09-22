import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown, Loader2, LocateFixed, Settings } from 'lucide-react';
import { useAuth } from '../context/authContext';
import { useAddresses } from '../hooks/useAddresses';
import { useGPS } from '../hooks/useGPS';
import { reverseGeocode } from '../utils/geo';
import { Link } from 'react-router-dom';

const STORE_KEY = 'cartify_delivery_location';

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const LocationBar = () => {
  const { user } = useAuth();
  const { addresses, addressesLoading, fetchAddresses } = useAddresses(user?.id);
  const { position, loading: gpsLoading, error: gpsError, start, stop } = useGPS();
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [choice, setChoice] = useState(readStored);
  const popRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (user?.id) fetchAddresses();
  }, [user?.id, fetchAddresses]);

  // One-shot: when a GPS fix arrives and we asked for it, reverse-geocode it.
  const waitingGpsRef = useRef(false);
  useEffect(() => {
    if (position && waitingGpsRef.current) {
      waitingGpsRef.current = false;
      stop();
      setResolving(true);
      reverseGeocode(position.latitude, position.longitude)
        .then((a) => {
          const label = [a.city, a.state, a.pinCode].filter(Boolean).join(' — ');
          const next = {
            label: label || a.displayName || 'Current location',
            lat: position.latitude,
            lng: position.longitude,
            source: 'gps',
          };
          localStorage.setItem(STORE_KEY, JSON.stringify(next));
          setChoice(next);
          setGeocodeError('');
          setOpen(false);
        })
        .catch(() => setGeocodeError('Could not look up that location. Try again.'))
        .finally(() => setResolving(false));
    }
  }, [position, stop]);

  const pickAddress = useCallback((addr) => {
    const label = addr.city
      ? `${addr.street || ''} ${addr.city} — ${addr.pinCode || ''}`.trim()
      : `${addr.street || ''} ${addr.pinCode || ''}`.trim();
    const next = {
      label: label || addr.city || 'Saved address',
      lat: addr.latitude,
      lng: addr.longitude,
      source: 'address',
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    setChoice(next);
    setOpen(false);
  }, []);

  const useMyLocation = useCallback(() => {
    setGeocodeError('');
    waitingGpsRef.current = true;
    start();
  }, [start]);

  const display = choice?.label || 'Deliver to';

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Delivery location: ${display}`}
        className="hidden sm:flex items-center gap-1.5 text-teal-50 hover:text-white transition-colors min-w-[44px] min-h-[44px] -my-4 px-2 justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200 rounded"
      >
        <MapPin size={13} aria-hidden="true" />
        <span className="font-medium max-w-[150px] truncate">{display}</span>
        <ChevronDown size={12} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose delivery location"
          className="fixed sm:absolute sm:left-0 sm:top-full sm:mt-1 w-full sm:w-80 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 z-50 p-4 sm:p-5"
        >
          <p className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-teal-600" aria-hidden="true" />
            Deliver to
          </p>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={resolving}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-teal-50 text-teal-700 font-semibold hover:bg-teal-100 transition-colors min-h-[44px] disabled:opacity-60"
          >
            {resolving || gpsLoading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed size={16} aria-hidden="true" />
            )}
            {resolving ? 'Finding your location…' : 'Use my current location'}
          </button>
          {(geocodeError || (gpsError && waitingGpsRef.current)) && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {geocodeError || gpsError?.message || 'Location unavailable.'}
            </p>
          )}

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Saved addresses</p>
            {addressesLoading ? (
              <p className="text-sm text-gray-400 animate-pulse" aria-label="Loading addresses">Loading…</p>
            ) : addresses.length > 0 ? (
              <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                {addresses.map((addr) => (
                  <li key={addr._id}>
                    <button
                      type="button"
                      onClick={() => pickAddress(addr)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors min-h-[44px]"
                    >
                      <span className="block font-semibold text-gray-700">{addr.fullName}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {addr.street}, {addr.city}, {addr.state} - {addr.pinCode}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No saved addresses yet.</p>
            )}
          </div>

          <Link
            to="/profile?tab=addresses"
            onClick={() => setOpen(false)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 min-h-[44px]"
          >
            <Settings size={14} aria-hidden="true" /> Manage addresses or pin on map
          </Link>
        </div>
      )}
    </div>
  );
};

export default LocationBar;