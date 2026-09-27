import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminProducts } from './useAdminProducts';
import * as productsApi from '../services/productsApi';

vi.mock('../services/productsApi', () => ({
  fetchProducts: vi.fn(),
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  seedProducts: vi.fn(),
  clearAllProducts: vi.fn(),
}));

describe('useAdminProducts (F-18 — admin catalogue cap)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the first 100 products (server cap), never an unbounded list', async () => {
    productsApi.fetchProducts.mockResolvedValue({ data: { products: [], total: 0, pages: 1 } });
    const { result } = renderHook(() => useAdminProducts());

    await act(async () => {
      await result.current.fetchProducts();
    });

    expect(productsApi.fetchProducts).toHaveBeenCalledTimes(1);
    expect(productsApi.fetchProducts).toHaveBeenCalledWith({ limit: 100 });
  });

  it('stores the returned products and clears the loading flag', async () => {
    const rows = [{ _id: 'p1', title: 'Shirt' }];
    productsApi.fetchProducts.mockResolvedValue({ data: { products: rows, total: 1, pages: 1 } });
    const { result } = renderHook(() => useAdminProducts());

    expect(result.current.loading).toBe(true);
    await act(async () => {
      await result.current.fetchProducts();
    });

    expect(result.current.products).toEqual(rows);
    expect(result.current.loading).toBe(false);
  });
});
