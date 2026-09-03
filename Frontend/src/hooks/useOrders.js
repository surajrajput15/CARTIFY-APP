import { useState, useCallback } from 'react';
import { fetchMyOrders } from '../services/ordersApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';

export const useOrders = (userId) => {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const response = await fetchMyOrders(userId);
      setOrders(response.data);
    } catch (error) {
      console.error("Failed to fetch orders", error);
      toast.error(handleApiError(error, "Failed to load orders"));
    } finally {
      setLoadingOrders(false);
    }
  }, [userId]);

  return { orders, loadingOrders, fetchOrders };
};
