import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchMyOrders } from '../services/ordersApi';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/apiError';
import { logError } from '../utils/logger';

export const useOrders = (userId) => {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  // Distinguishes "no orders yet" from "fetch failed" so the tab can offer a
  // retry instead of showing a misleading empty history.
  const [ordersError, setOrdersError] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!userId) return [];
    if (mountedRef.current) setLoadingOrders(true);
    try {
      const response = await fetchMyOrders(userId);
      if (mountedRef.current) {
        setOrders(response.data);
        setOrdersError(false);
      }
      return response.data;
    } catch (error) {
      logError("Failed to fetch orders", error);
      if (mountedRef.current) setOrdersError(true);
      toast.error(handleApiError(error, "Failed to load orders"));
      return [];
    } finally {
      if (mountedRef.current) setLoadingOrders(false);
    }
  }, [userId]);

  return { orders, loadingOrders, ordersError, fetchOrders };
};
