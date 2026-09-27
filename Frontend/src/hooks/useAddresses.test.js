import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddresses } from './useAddresses';
import * as addressesApi from '../services/addressesApi';

vi.mock('../services/addressesApi', () => ({
  fetchAddresses: vi.fn(),
  addAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const HOME = { _id: 'a1', label: 'Home', city: 'Pune' };

describe('useAddresses (F-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empties the list when the last address is deleted', async () => {
    addressesApi.fetchAddresses.mockResolvedValueOnce({ data: [HOME] });
    addressesApi.deleteAddress.mockResolvedValueOnce({ data: { ok: true } });
    // The refetch after deleting the last address returns [] — a legitimate
    // empty result must be adopted, not discarded (the original P0 bug).
    addressesApi.fetchAddresses.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useAddresses('u1'));
    await act(async () => {
      await result.current.fetchAddresses();
    });
    expect(result.current.addresses).toHaveLength(1);

    await act(async () => {
      await result.current.deleteAddress('a1');
    });

    expect(result.current.addresses).toEqual([]);
    expect(result.current.addressesLoading).toBe(false);
  });

  it('an out-of-order stale response does not clobber newer data', async () => {
    let resolveSlow;
    addressesApi.fetchAddresses
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
      .mockResolvedValueOnce({ data: [{ ...HOME, _id: 'fresh' }] });

    const { result } = renderHook(() => useAddresses('u1'));

    let slowPromise;
    await act(async () => {
      slowPromise = result.current.fetchAddresses(); // request #1 — stays pending
    });

    await act(async () => {
      await result.current.fetchAddresses(); // request #2 — resolves first
    });
    expect(result.current.addresses).toEqual([{ ...HOME, _id: 'fresh' }]);

    // The old request finally answers with outdated data — it must be dropped.
    await act(async () => {
      resolveSlow({ data: [{ ...HOME, _id: 'stale' }] });
      await slowPromise;
    });
    expect(result.current.addresses).toEqual([{ ...HOME, _id: 'fresh' }]);
    expect(result.current.addressesLoading).toBe(false);
  });

  it('does not apply an in-flight response from a previous owner', async () => {
    let resolveOldOwner;
    addressesApi.fetchAddresses.mockImplementationOnce(
      () => new Promise((resolve) => { resolveOldOwner = resolve; })
    );

    const { result, rerender } = renderHook(({ userId }) => useAddresses(userId), {
      initialProps: { userId: 'user-a' },
    });

    let pending;
    await act(async () => {
      pending = result.current.fetchAddresses();
    });

    // Switch owner while the old request is in flight.
    await act(async () => {
      rerender({ userId: 'user-b' });
    });

    await act(async () => {
      resolveOldOwner({ data: [{ ...HOME, _id: 'from-user-a' }] });
      await pending;
    });

    expect(result.current.addresses).toEqual([]);
  });
});
