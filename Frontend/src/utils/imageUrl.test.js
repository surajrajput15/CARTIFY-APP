import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({
  API_URL: 'https://api.example.com',
}));

import { resolveImageUrl } from './imageUrl';

describe('resolveImageUrl', () => {
  it('returns src as-is for remote URLs', () => {
    expect(resolveImageUrl('https://images.unsplash.com/photo-1')).toBe('https://images.unsplash.com/photo-1');
  });

  it('prefixes API_URL for local uploads', () => {
    expect(resolveImageUrl('/uploads/abc123.png')).toBe('https://api.example.com/uploads/abc123.png');
  });

  it('returns the placeholder for falsy values', () => {
    const placeholder = resolveImageUrl('');
    expect(placeholder).toContain('data:image/svg+xml');
    expect(resolveImageUrl(null)).toBe(placeholder);
    expect(resolveImageUrl(undefined)).toBe(placeholder);
  });
});