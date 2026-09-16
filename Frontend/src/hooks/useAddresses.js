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
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchAddresses = useCallback(async () => {
    if (mountedRef.current) setAddressesLoading(true);
    try {
      const response = await addressesApi.fetchAddresses(userId);
      if (mountedRef.current) {
        setAddresses(response.data);
        setAddressesError('');
      }
      return response.data;
    } catch (error) {
      logError("Failed to fetch addresses", error);
      if (mountedRef.current) {
        // Track the failure separately so the UI can show an error panel
        // instead of faking an "empty address list". Existing list data is
        // kept so a transient failure doesn't wipe what we already have.
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
      await addressesApi.addAddress(address);
      await fetchAddresses();
    } catch (err) {
      logError("Failed to save address", err);
      // No toast here — the caller (AddressManager) owns user feedback so
      // failures don't double-toast.
      throw err;
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id) => {
    try {
      await addressesApi.deleteAddress(id);
      await fetchAddresses();
    } catch (err) {
      logError("Failed to delete address", err);
      // No toast here — the caller (ProfilePage) owns user feedback.
      throw err;
    }
  }, [fetchAddresses]);

  return { addresses, addressesLoading, addressesError, fetchAddresses, saveAddress, deleteAddress };
};
