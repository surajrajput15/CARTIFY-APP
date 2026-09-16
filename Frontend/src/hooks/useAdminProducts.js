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
    const price = Number(product.price);
    const stock = Number(product.countInStock);
    const rate = Number(product.rating?.rate ?? 0);
    const count = Number(product.rating?.count ?? 0);

    // Data-integrity guards mirroring the server rules. `Number()` can silently
    // produce NaN (which serializes to JSON `null`), so verify before building
    // the payload — a null price would corrupt the financial data model.
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be a whole number 0 or above');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 5) {
      throw new Error('Rating must be between 0 and 5');
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Review count must be a whole number 0 or above');
    }

    const payload = {
      ...product,
      price,
      countInStock: stock,
      rating: { rate, count }
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
