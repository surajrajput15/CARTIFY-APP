import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeo } from './useSeo';

describe('useSeo', () => {
  beforeEach(() => {
    document.title = 'Cartify';
  });

  afterEach(() => {
    document.querySelectorAll('script[data-dynamic-seo]').forEach((el) => el.remove());
  });

  it('updates document title', () => {
    renderHook(() => useSeo({ title: 'About the Creator' }));
    expect(document.title).toBe('Cartify | About the Creator');
  });

  it('updates meta description, canonical, and social tags', () => {
    renderHook(() =>
      useSeo({
        title: 'Special Offers',
        description: 'Exclusive seasonal deals on premium gadgets.',
        canonical: '/offers',
        image: 'https://example.com/banner.jpg',
      })
    );

    const desc = document.querySelector('meta[name="description"]');
    expect(desc?.getAttribute('content')).toBe('Exclusive seasonal deals on premium gadgets.');

    const ogTitle = document.querySelector('meta[property="og:title"]');
    expect(ogTitle?.getAttribute('content')).toBe('Cartify | Special Offers');

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://cartify-hub.vercel.app/offers');

    const ogImg = document.querySelector('meta[property="og:image"]');
    expect(ogImg?.getAttribute('content')).toBe('https://example.com/banner.jpg');
  });

  it('injects and cleans up JSON-LD schema', () => {
    const testSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [],
    };

    const { unmount } = renderHook(() =>
      useSeo({
        title: 'FAQ',
        schema: testSchema,
      })
    );

    const script = document.querySelector('script[data-dynamic-seo="true"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script.textContent)).toEqual(testSchema);

    unmount();
    expect(document.querySelector('script[data-dynamic-seo="true"]')).toBeNull();
  });
});
