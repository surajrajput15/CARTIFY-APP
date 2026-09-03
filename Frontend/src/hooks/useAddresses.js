import { useState, useCallback } from 'react';
import * as addressesApi from '../services/addressesApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';

export const useAddresses = (userId, initialLoading = false) => {
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(initialLoading);

  const fetchAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const response = await addressesApi.fetchAddresses(userId);
      setAddresses(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch addresses", error);
      toast.error(handleApiError(error, "Failed to load addresses"));
      return [];
    } finally {
      setAddressesLoading(false);
    }
  }, [userId]);

  const saveAddress = useCallback(async (address) => {
    try {
      await addressesApi.addAddress(address);
      await fetchAddresses();
    } catch (err) {
      console.error("Failed to save address", err);
      toast.error(handleApiError(err, "Failed to save address"));
      throw err;
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id) => {
    try {
      await addressesApi.deleteAddress(id);
      await fetchAddresses();
    } catch (err) {
      console.error("Failed to delete address", err);
      toast.error(handleApiError(err, "Failed to delete address"));
      throw err;
    }
  }, [fetchAddresses]);

  return { addresses, addressesLoading, fetchAddresses, saveAddress, deleteAddress };
};
