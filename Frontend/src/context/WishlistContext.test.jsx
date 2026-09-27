import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { WishlistProvider, useWishlist } from './WishlistContext';

// Shared mutable auth state — vi.hoisted so the hoisted mock factory can see it.
const state = vi.hoisted(() => ({ user: null }));

vi.mock('./authContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../services/wishlistApi', () => ({
  fetchWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../utils/logger', () => ({ logError: vi.fn() }));

import { fetchWishlist, addToWishlist } from '../services/wishlistApi';
import toast from 'react-hot-toast';

const capture = vi.fn();
const Probe = () => {
  capture(useWishlist());
  return null;
};

describe('wishlist auth gate (401 fix)', () => {
  beforeEach(() => {
    localStorage.clear();
    state.user = null;
    capture.mockClear();
    vi.clearAllMocks();
    fetchWishlist.mockResolvedValue({ data: { products: [] } });
    addToWishlist.mockResolvedValue({});
  });

  it('blocks guests: no API call, login prompt, returns false', async () => {
    render(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    );
    const api = capture.mock.calls.at(-1)[0];

    let ok;
    await act(async () => {
      ok = await api.addToWishlist({ _id: 'p1', title: 'Widget', price: 10 });
    });

    expect(ok).toBe(false);
    expect(addToWishlist).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('log in'));
  });

  it('guests never get a server fetch either', async () => {
    render(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    );
    const api = capture.mock.calls.at(-1)[0];

    await act(async () => {
      await api.refreshWishlist();
    });

    expect(fetchWishlist).not.toHaveBeenCalled();
  });

  it('signed-in users call the API and the item lands in the wishlist', async () => {
    state.user = { id: 'u1' };
    render(
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    );
    await act(async () => {
      await fetchWishlist; // let the auth-effect fetch settle inside act
    });

    const api = capture.mock.calls.at(-1)[0];
    let ok;
    await act(async () => {
      ok = await api.addToWishlist({ _id: 'p1', title: 'Widget', price: 10 });
    });

    expect(ok).toBe(true);
    expect(addToWishlist).toHaveBeenCalledWith('p1');
    expect(toast.error).not.toHaveBeenCalled();

    const latest = capture.mock.calls.at(-1)[0];
    expect(latest.wishlist.some((p) => p.productId === 'p1')).toBe(true);
  });
});
