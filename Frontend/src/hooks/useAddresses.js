import { useState, useCallback, useEffect, useRef } from 'react';
import * as addressesApi from '../services/addressesApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

export const useAddresses = (userId, initialLoading = false) => {
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(initialLoading);
  const [addressesError, setAddressesError] = useState('');
  const mountedRef = useRef(true);
  // Request-sequence token: only the newest in-flight fetch may write state,
  // so a slow response can never clobber newer data (F-01).
  const requestSeqRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Invalidate in-flight responses when the owner changes.
  useEffect(() => {
    requestSeqRef.current += 1;
  }, [userId]);

const fetchAddresses = useCallback(async () => {
    if (!userId) return [];
    const seq = ++requestSeqRef.current;
    if (mountedRef.current) setAddressesLoading(true);
    try {
      const response = await addressesApi.fetchAddresses(userId);
      if (mountedRef.current && seq === requestSeqRef.current) {
        // Server is the source of truth — always adopt it, including [].
        setAddresses(response.data);
        setAddressesError('');
      }
      return response.data;
    } catch (error) {
      logError("Failed to fetch addresses", error);
      if (mountedRef.current && seq === requestSeqRef.current) {
        setAddressesError(handleApiError(error, "Failed to load addresses"));
      }
      toast.error(handleApiError(error, "Failed to load addresses"));
      return [];
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setAddressesLoading(false);
    }
  }, [userId]);

const saveAddress = useCallback(async (address) => {
    try {
      let saved = null;
      if (address._id) {
        const { _id, ...cleanAddress } = address;
        const res = await addressesApi.updateAddress(_id, cleanAddress);
        saved = res.data;
        if (mountedRef.current && saved && saved._id) {
          setAddresses((prev) => prev.map((a) => (a._id === saved._id ? saved : a)));
        }
      } else {
        const res = await addressesApi.addAddress(address);
        saved = res.data;
        if (mountedRef.current && saved && saved._id) {
          setAddresses((prev) => (
            prev.some((a) => a._id === saved._id)
              ? prev.map((a) => (a._id === saved._id ? saved : a))
              : [saved, ...prev]
          ));
        }
      }
      await fetchAddresses();
      return saved;
    } catch (err) {
      logError("Failed to save address", err);
      // No toast here �?" the caller (AddressManager) owns user feedback so
      // failures don't double-toast.
      throw err;
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id) => {
    try {
      await addressesApi.deleteAddress(id);
      if (mountedRef.current) {
        setAddresses((prev) => prev.filter((a) => a._id !== id));
      }
      await fetchAddresses();
    } catch (err) {
      logError("Failed to delete address", err);
      // No toast here �?" the caller (ProfilePage) owns user feedback.
      throw err;
    }
  }, [fetchAddresses]);

  return { addresses, addressesLoading, addressesError, fetchAddresses, saveAddress, deleteAddress };
};
