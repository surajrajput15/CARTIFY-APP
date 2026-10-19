import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LazySection from './LazySection';

describe('LazySection component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children immediately if IntersectionObserver is unavailable', () => {
    const originalObserver = globalThis.IntersectionObserver;
    try {
      delete globalThis.IntersectionObserver;

      render(
        <LazySection placeholder={<div>Placeholder content</div>}>
          <div data-testid="lazy-child">Lazy Content</div>
        </LazySection>
      );

      expect(screen.getByTestId('lazy-child')).toBeInTheDocument();
      expect(screen.queryByText('Placeholder content')).not.toBeInTheDocument();
    } finally {
      globalThis.IntersectionObserver = originalObserver;
    }
  });

  it('renders placeholder initially when IntersectionObserver is active but not intersecting', () => {
    let _observerCallback;
    class MockObserver {
      constructor(cb) {
        _observerCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const originalObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockObserver;

    try {
      render(
        <LazySection placeholder={<div>Loading section placeholder...</div>}>
          <div data-testid="lazy-child">Lazy Content</div>
        </LazySection>
      );

      expect(screen.getByText('Loading section placeholder...')).toBeInTheDocument();
      expect(screen.queryByTestId('lazy-child')).not.toBeInTheDocument();
    } finally {
      globalThis.IntersectionObserver = originalObserver;
    }
  });

  it('switches to children when intersection occurs', () => {
    let observerCallback;
    class MockObserver {
      constructor(cb) {
        observerCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const originalObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockObserver;

    try {
      const { rerender } = render(
        <LazySection placeholder={<div>Loading section placeholder...</div>}>
          <div data-testid="lazy-child">Lazy Content</div>
        </LazySection>
      );

      expect(screen.getByText('Loading section placeholder...')).toBeInTheDocument();

      // Trigger intersection
      act(() => {
        observerCallback([{ isIntersecting: true }]);
      });

      rerender(
        <LazySection placeholder={<div>Loading section placeholder...</div>}>
          <div data-testid="lazy-child">Lazy Content</div>
        </LazySection>
      );

      expect(screen.getByTestId('lazy-child')).toBeInTheDocument();
      expect(screen.queryByText('Loading section placeholder...')).not.toBeInTheDocument();
    } finally {
      globalThis.IntersectionObserver = originalObserver;
    }
  });
});
