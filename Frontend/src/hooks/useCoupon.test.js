import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCoupon } from './useCoupon';
import { validateCoupon, findBestCoupon } from '../services/couponsApi';

vi.mock('../services/couponsApi', () => ({
  validateCoupon: vi.fn(),
  findBestCoupon: vi.fn(),
}));

const cart = [{ _id: 'p1', quantity: 2, price: 500, category: 'electronics' }];
const coupon = { code: 'SAVE20', discount: 200, type: 'percentage', value: 20 };

describe('useCoupon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    validateCoupon.mockResolvedValue({ data: { coupon } });
    findBestCoupon.mockResolvedValue({ data: { found: true, coupon } });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // The production crash: useCoupon ran cart.map in a useMemo during render and
  // CartPage passed an undefined cart, so the memo threw before anything could
  // paint. Defaults must keep the hook usable with no cart at all.
  it('does not throw when cart is undefined', () => {
    expect(() => renderHook(() => useCoupon(undefined, undefined))).not.toThrow();
  });

  it('does not throw for a non-array cart', () => {
    expect(() => renderHook(() => useCoupon(null, 'nonsense'))).not.toThrow();
  });

  it('applies the explicit code argument instead of the stale input value', async () => {
    localStorage.setItem('cartify_coupon_code', 'OLDCODE');
    const { result } = renderHook(() => useCoupon(cart, 1000));

    // Mount re-validates the persisted code first, so assert on the call made
    // by the explicit apply, not the first call of the session.
    await waitFor(() => expect(validateCoupon).toHaveBeenCalledWith(
      'OLDCODE',
      1000,
      [{ productId: 'p1', quantity: 2, category: 'electronics' }],
    ));

    await act(async () => {
      result.current.applyCoupon('SAVE20');
    });

    await waitFor(() => expect(validateCoupon).toHaveBeenCalledTimes(2));
    expect(validateCoupon.mock.calls.at(-1)).toEqual([
      'SAVE20',
      1000,
      [{ productId: 'p1', quantity: 2, category: 'electronics' }],
    ]);
    await waitFor(() => expect(result.current.applied).toEqual(coupon));
    expect(result.current.code).toBe('SAVE20');
  });

  it('falls back to the current input value when no code is passed', async () => {
    const { result } = renderHook(() => useCoupon(cart, 1000));
    act(() => { result.current.setCode('flat10'); });

    await act(async () => {
      result.current.applyCoupon();
    });

    await waitFor(() => expect(validateCoupon).toHaveBeenCalledWith(
      'FLAT10',
      1000,
      [{ productId: 'p1', quantity: 2, category: 'electronics' }],
    ));
  });

  it('reports an error and applies nothing when the response has no coupon', async () => {
    validateCoupon.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCoupon(cart, 1000));

    await act(async () => {
      result.current.applyCoupon('SAVE20');
    });

    await waitFor(() => expect(result.current.error).toBe('Invalid or expired coupon'));
    expect(result.current.applied).toBeNull();
  });

  it('rejects an empty code without calling the API', async () => {
    const { result } = renderHook(() => useCoupon(cart, 1000));

    await act(async () => {
      result.current.applyCoupon('   ');
    });

    expect(validateCoupon).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Enter a coupon code');
  });

  it('surfaces a server error message', async () => {
    validateCoupon.mockRejectedValue({ response: { data: { message: 'Coupon expired' } } });
    const { result } = renderHook(() => useCoupon(cart, 1000));

    await act(async () => {
      result.current.applyCoupon('SAVE20');
    });

    await waitFor(() => expect(result.current.error).toBe('Coupon expired'));
  });

  it('handles the best-coupon search with an empty cart', async () => {
    const { result } = renderHook(() => useCoupon(undefined, undefined));

    await act(async () => {
      await result.current.applyBestCoupon();
    });

    expect(findBestCoupon).toHaveBeenCalledWith(0, []);
  });

  it('reports when no coupon applies to the cart', async () => {
    findBestCoupon.mockResolvedValue({ data: { found: false } });
    const { result } = renderHook(() => useCoupon(cart, 1000));

    await act(async () => {
      await result.current.applyBestCoupon();
    });

    expect(result.current.applied).toBeNull();
    expect(result.current.error).toBe('No coupons apply to this cart right now');
  });

  it('clears the persisted code on clearCoupon', async () => {
    const { result } = renderHook(() => useCoupon(cart, 1000));
    localStorage.setItem('cartify_coupon_code', 'SAVE20');

    act(() => { result.current.clearCoupon(); });

    expect(localStorage.getItem('cartify_coupon_code')).toBeNull();
    expect(result.current.code).toBe('');
  });
});
