import { useState, useCallback } from 'react';
import * as productsApi from '../services/productsApi';
import toast from 'react-hot-toast';
import seedProductData from '../data/seedProducts';
import { handleApiError } from '../utils/apiError';

export const useAdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await productsApi.fetchProducts({ limit: 100 });
      setProducts(Array.isArray(data) ? data : data.products);
    } catch (err) {
      console.error('Failed to fetch products', err);
      toast.error(handleApiError(err, 'Failed to fetch products'));
    } finally {
      setLoading(false);
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
        toast.success('Product updated successfully');
      } else {
        await productsApi.addProduct(payload);
        toast.success('Product saved successfully');
      }
      await fetchProducts();
    } catch (err) {
      console.error('Failed to save product', err);
      toast.error(handleApiError(err, 'Failed to save product'));
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id) => {
    try {
      await productsApi.deleteProduct(id);
      await fetchProducts();
      toast.success('Product deleted');
    } catch (err) {
      console.error('Failed to delete product', err);
      toast.error(handleApiError(err, 'Failed to delete product'));
    }
  }, [fetchProducts]);

  const seedProducts = useCallback(async () => {
    try {
      const { data } = await productsApi.seedProducts(seedProductData);
      toast.success(`${data.count} products seeded successfully!`);
      await fetchProducts();
    } catch (err) {
      console.error('Failed to seed products', err);
      toast.error(handleApiError(err, 'Failed to seed products'));
    }
  }, [fetchProducts]);

  const clearAllProducts = useCallback(async () => {
    try {
      await productsApi.clearAllProducts();
      await fetchProducts();
      toast.success('All products cleared');
    } catch (err) {
      console.error('Failed to clear products', err);
      toast.error(handleApiError(err, 'Failed to clear products'));
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
