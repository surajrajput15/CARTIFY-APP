import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRazorpayPayment } from './useRazorpayPayment';
import { createPaymentOrder } from '../services/ordersApi';
import toast from 'react-hot-toast';

vi.mock('../services/ordersApi', () => ({
  createPaymentOrder: vi.fn(),
  verifyPayment: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal()),
  RAZORPAY_KEY: 'rzp_test_key',
}));

const ADDRESS = { phone: '9999999999', city: 'Pune' };

const setup = (cart, couponCode = null) => {
  let capturedOptions = null;
  window.Razorpay = vi.fn(function RazorpayMock(options) {
    capturedOptions = options;
    this.open = vi.fn();
    this.close = vi.fn();
  });

  const hook = renderHook(() =>
    useRazorpayPayment({
      user: { name: 'Test', email: 't@example.com' },
      cart,
      clearCart: vi.fn(),
      navigate: vi.fn(),
      selectedAddress: ADDRESS,
      couponCode,
      clearCoupon: vi.fn(),
    })
  );
  return { ...hook, getOptions: () => capturedOptions };
};

describe('useRazorpayPayment (F-02 — server-authoritative amount)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('opens the modal with the server amount, not a client-side total', async () => {
    createPaymentOrder.mockResolvedValue({
      data: { order: { id: 'order_1', amount: 50000, calculatedAmount: 500 } },
    });

    const { result, getOptions } = setup([{ _id: 'p1', price: 500, quantity: 1 }]);
    await act(async () => {
      await result.current.handlePayment();
    });

    // Backend charged ₹500 (calculatedAmount) → modal gets 50000 paise.
    expect(getOptions().amount).toBe(50000);
    expect(getOptions().amount / 100).toBe(500);
    // The client only ever sends ids + quantities + address.
    expect(createPaymentOrder).toHaveBeenCalledWith(
      [{ productId: 'p1', quantity: 1 }],
      ADDRESS,
      undefined
    );
    expect(getOptions().order_id).toBe('order_1');
  });

  it('warns when the server recomputed a different total', async () => {
    createPaymentOrder.mockResolvedValue({
      data: { order: { id: 'order_2', amount: 50000, calculatedAmount: 500 } },
    });

    // Client thinks the cart is ₹400; the live catalog says ₹500.
    const { result, getOptions } = setup([{ _id: 'p1', price: 400, quantity: 1 }]);
    await act(async () => {
      await result.current.handlePayment();
    });

    expect(getOptions().amount).toBe(50000);
    expect(toast.warn).toHaveBeenCalledWith(
      expect.stringContaining('Order total refreshed to')
    );
  });

  it('does not warn when the totals agree', async () => {
    createPaymentOrder.mockResolvedValue({
      data: { order: { id: 'order_3', amount: 50000, calculatedAmount: 500 } },
    });

    const { result } = setup([{ _id: 'p1', price: 500, quantity: 1 }]);
    await act(async () => {
      await result.current.handlePayment();
    });

    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('short-circuits a fully-discounted free order without opening the modal', async () => {
    createPaymentOrder.mockResolvedValue({ data: { freeOrder: true } });
    const clearCart = vi.fn();
    const navigate = vi.fn();

    let captured = false;
    window.Razorpay = vi.fn(() => { captured = true; });

    const { result } = renderHook(() =>
      useRazorpayPayment({
        user: { name: 'T', email: 't@example.com' },
        cart: [{ _id: 'p1', price: 500, quantity: 1 }],
        clearCart,
        navigate,
        selectedAddress: ADDRESS,
        couponCode: 'FREE100',
        clearCoupon: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handlePayment();
    });

    expect(captured).toBe(false);
    expect(clearCart).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/profile?tab=orders');
  });
});

describe('useRazorpayPayment (F-09 — synchronous double-fire guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('creates exactly one payment order for a rapid double-click', async () => {
    createPaymentOrder.mockResolvedValue({
      data: { order: { id: 'order_dbl', amount: 50000, calculatedAmount: 500 } },
    });

    const { result, getOptions } = setup([{ _id: 'p1', price: 500, quantity: 1 }]);
    await act(async () => {
      // Two calls in the same tick — `loading` state alone cannot stop the
      // second one before React re-renders the disabled button.
      const first = result.current.handlePayment();
      const second = result.current.handlePayment();
      await Promise.all([first, second]);
    });

    expect(createPaymentOrder).toHaveBeenCalledTimes(1);
    expect(getOptions().order_id).toBe('order_dbl');
  });
});
