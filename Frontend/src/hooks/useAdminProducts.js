import { useState, useCallback, useEffect, useRef } from 'react';
import * as productsApi from '../services/productsApi';
import seedProductData from '../data/seedProducts';
import { logError } from '../utils/logger';

// NOTE: this hook never toasts and always rethrows — all user-facing feedback
// lives with the callers (AdminPage), so success/error messages appear exactly
// once and failures never look like successes.
export const useAdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await productsApi.fetchProducts({ limit: 100 });
      if (mountedRef.current) setProducts(Array.isArray(data) ? data : data.products);
    } catch (err) {
      logError('Failed to fetch products', err);
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const saveProduct = useCallback(async ({ product, editingProduct }) => {
    const payload = {
      ...product,
      price: Number(product.price),
      rating: { rate: Number(product.rating.rate), count: Number(product.rating.count) }
    };

    try {
      if (editingProduct) {
        await productsApi.updateProduct(editingProduct._id, payload);
      } else {
        await productsApi.addProduct(payload);
      }
      await fetchProducts();
    } catch (err) {
      logError('Failed to save product', err);
      throw err;
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id) => {
    try {
      await productsApi.deleteProduct(id);
      await fetchProducts();
    } catch (err) {
      logError('Failed to delete product', err);
      throw err;
    }
  }, [fetchProducts]);

  const seedProducts = useCallback(async () => {
    try {
      const { data } = await productsApi.seedProducts(seedProductData);
      await fetchProducts();
      return data;
    } catch (err) {
      logError('Failed to seed products', err);
      throw err;
    }
  }, [fetchProducts]);

  const clearAllProducts = useCallback(async () => {
    try {
      await productsApi.clearAllProducts();
      await fetchProducts();
    } catch (err) {
      logError('Failed to clear products', err);
      throw err;
    }
  }, [fetchProducts]);

  return {
    products,
    loading,
    fetchProducts,
    saveProduct,
    deleteProduct,
    seedProducts,
    clearAllProducts
  };
};
