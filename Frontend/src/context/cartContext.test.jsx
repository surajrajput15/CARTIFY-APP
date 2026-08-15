import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { CartProvider, useCart } from './cartContext';

vi.mock('../services/cartApi', () => ({
  fetchCart: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  mergeCart: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  syncCart: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  clearServerCart: vi.fn(() => Promise.resolve({ data: {} })),
}));

vi.mock('./authContext', () => ({
  useAuth: () => ({ user: null }),
}));

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('starts with an empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.cart).toEqual([]);
  });

  it('adds a product to the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { _id: 'p1', title: 'Test', price: 100, image: 'img' };

    act(() => {
      result.current.addToCart(product, 1);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]).toMatchObject({ _id: 'p1', quantity: 1 });
  });

  it('increments quantity when the same product is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { _id: 'p1', title: 'Test', price: 100 };

    act(() => {
      result.current.addToCart(product, 1);
    });
    act(() => {
      result.current.addToCart(product, 2);
    });

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
  });

  it('removes a product from the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { _id: 'p1', title: 'Test', price: 100 };

    act(() => {
      result.current.addToCart(product, 1);
    });
    act(() => {
      result.current.removeFromCart('p1');
    });

    expect(result.current.cart).toEqual([]);
  });

  it('updates quantity with increase and decrease', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { _id: 'p1', title: 'Test', price: 100 };

    act(() => {
      result.current.addToCart(product, 2);
    });
    act(() => {
      result.current.updateQuantity('p1', 'decrease');
    });
    expect(result.current.cart[0].quantity).toBe(1);

    act(() => {
      result.current.updateQuantity('p1', 'increase');
    });
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { _id: 'p1', title: 'Test', price: 100 };

    act(() => {
      result.current.addToCart(product, 1);
    });
    act(() => {
      result.current.clearCart();
    });

    expect(result.current.cart).toEqual([]);
  });
});