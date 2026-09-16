import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom's Navigator exposes most fields via prototype getters, so a plain
// spread `...window.navigator` copies nothing (e.g. userAgent). Rebuild with
// the real values explicitly, plus `standalone` for PWA install checks.
Object.defineProperty(window, 'navigator', {
  writable: true,
  configurable: true,
  value: {
    userAgent: window.navigator.userAgent,
    language: window.navigator.language,
    languages: Array.from(window.navigator.languages || []),
    platform: window.navigator.platform,
    onLine: window.navigator.onLine,
    product: window.navigator.product,
  },
});

// Configurable so `delete window.navigator.standalone` (used by pwa tests) works.
Object.defineProperty(window.navigator, 'standalone', {
  writable: true,
  configurable: true,
  enumerable: true,
  value: false,
});