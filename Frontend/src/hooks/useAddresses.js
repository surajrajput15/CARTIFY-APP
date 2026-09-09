import { useState, useCallback, useEffect, useRef } from 'react';
import * as addressesApi from '../services/addressesApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

export const useAddresses = (userId, initialLoading = false) => {
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(initialLoading);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchAddresses = useCallback(async () => {
    if (mountedRef.current) setAddressesLoading(true);
    try {
      const response = await addressesApi.fetchAddresses(userId);
      if (mountedRef.current) setAddresses(response.data);
      return response.data;
    } catch (error) {
      logError("Failed to fetch addresses", error);
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
      toast.error(handleApiError(err, "Failed to save address"));
      throw err;
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id) => {
    try {
      await addressesApi.deleteAddress(id);
      await fetchAddresses();
    } catch (err) {
      logError("Failed to delete address", err);
      toast.error(handleApiError(err, "Failed to delete address"));
      throw err;
    }
  }, [fetchAddresses]);

  return { addresses, addressesLoading, fetchAddresses, saveAddress, deleteAddress };
};
