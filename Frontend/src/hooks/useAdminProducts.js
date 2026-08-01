import { useState, useCallback } from 'react';
import * as productsApi from '../services/productsApi';
import toast from 'react-hot-toast';
import seedProductData from '../data/seedProducts';

export const useAdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await productsApi.fetchProducts({ limit: 100 });
      setProducts(Array.isArray(data) ? data : data.products);
    } catch (err) {
      console.error('Failed to fetch products', err);
      toast.error('Failed to fetch products');
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

    if (editingProduct) {
      await productsApi.updateProduct(editingProduct._id, payload);
      toast.success('Product updated successfully');
    } else {
      await productsApi.addProduct(payload);
      toast.success('Product saved successfully');
    }

    await fetchProducts();
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id) => {
    await productsApi.deleteProduct(id);
    await fetchProducts();
    toast.success('Product deleted');
  }, [fetchProducts]);

  const seedProducts = useCallback(async () => {
    const { data } = await productsApi.seedProducts(seedProductData);
    toast.success(`${data.count} products seeded successfully!`);
    await fetchProducts();
  }, [fetchProducts]);

  const clearAllProducts = useCallback(async () => {
    await productsApi.clearAllProducts();
    await fetchProducts();
    toast.success('All products cleared');
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
