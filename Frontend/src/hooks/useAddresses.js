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
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

const fetchAddresses = useCallback(async () => {
    if (!userId) return [];
    if (mountedRef.current) setAddressesLoading(true);
    try {
      const response = await addressesApi.fetchAddresses(userId);
      if (mountedRef.current) {
        // Server is the source of truth — always adopt it, including [].
        setAddresses(response.data);
        setAddressesError('');
      }
      return response.data;
    } catch (error) {
      logError("Failed to fetch addresses", error);
      if (mountedRef.current) {
        setAddressesError(handleApiError(error, "Failed to load addresses"));
      }
      toast.error(handleApiError(error, "Failed to load addresses"));
      return [];
    } finally {
      if (mountedRef.current) setAddressesLoading(false);
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

  const updateAddress = useCallback(async (id, address) => {
    try {
      // Strip server-managed fields before PUT — the backend only accepts the
      // six address fields (F-01 follow-up hygiene).
      const { ...cleanAddress } = address || {};
      delete cleanAddress._id;
      delete cleanAddress.userId;
      delete cleanAddress.__v;
      delete cleanAddress.createdAt;
      delete cleanAddress.updatedAt;
      const res = await addressesApi.updateAddress(id, cleanAddress);
      const saved = res.data;
      if (mountedRef.current && saved && saved._id) {
        setAddresses((prev) => prev.map((a) => (a._id === saved._id ? saved : a)));
      }
      await fetchAddresses();
      return saved;
    } catch (err) {
      logError("Failed to update address", err);
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

  return { addresses, addressesLoading, addressesError, fetchAddresses, saveAddress, updateAddress, deleteAddress };
};
