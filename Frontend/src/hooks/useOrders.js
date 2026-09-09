import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchMyOrders } from '../services/ordersApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

export const useOrders = (userId) => {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchOrders = useCallback(async () => {
    if (mountedRef.current) setLoadingOrders(true);
    try {
      const response = await fetchMyOrders(userId);
      if (mountedRef.current) setOrders(response.data);
    } catch (error) {
      logError("Failed to fetch orders", error);
      toast.error(handleApiError(error, "Failed to load orders"));
    } finally {
      if (mountedRef.current) setLoadingOrders(false);
    }
  }, [userId]);

  return { orders, loadingOrders, fetchOrders };
};
