import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageTitle } from './usePageTitle';

describe('usePageTitle', () => {
  beforeEach(() => {
    document.title = 'Cartify';
  });

  it('sets a branded route title', () => {
    renderHook(() => usePageTitle('Checkout'));
    expect(document.title).toBe('Cartify | Checkout');
  });

  it('falls back to the bare brand for falsy titles', () => {
    renderHook(() => usePageTitle(''));
    expect(document.title).toBe('Cartify');
  });

  it('updates the title when the prop changes (e.g. product finishes loading)', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Product Details' },
    });
    expect(document.title).toBe('Cartify | Product Details');
    rerender({ title: 'Wireless Headphones' });
    expect(document.title).toBe('Cartify | Wireless Headphones');
  });
});
