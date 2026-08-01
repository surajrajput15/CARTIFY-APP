import { useState, useCallback } from 'react';
import * as addressesApi from '../services/addressesApi';
import toast from 'react-hot-toast';

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
      toast.error("Failed to load addresses");
      return [];
    } finally {
      setAddressesLoading(false);
    }
  }, [userId]);

  const saveAddress = useCallback(async (address) => {
    await addressesApi.addAddress(address);
    await fetchAddresses();
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id) => {
    await addressesApi.deleteAddress(id);
    await fetchAddresses();
  }, [fetchAddresses]);

  return { addresses, addressesLoading, fetchAddresses, saveAddress, deleteAddress };
};
