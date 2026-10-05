import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import IntroGate, {
  SESSION_FLAG,
  INTRO_HOLD_MS,
  INTRO_EXIT_MS,
  REDUCED_HOLD_MS,
} from './IntroGate';

const originalMatchMedia = window.matchMedia;

const reducedMotionMatchMedia = (query) => ({
  matches: query.includes('reduced-motion'),
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const renderGate = (path = '/') => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <div data-app-shell><span>store</span></div>
      <IntroGate />
    </MemoryRouter>
  );
  return { ...result, shell: document.querySelector('[data-app-shell]') };
};

const heading = () => screen.queryByRole('heading', { name: /cartify/i });
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('IntroGate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    sessionStorage.clear();
  });

  it('shows the intro on the home route', () => {
    renderGate('/');
    expect(heading()).toBeInTheDocument();
    expect(screen.getByText('Your Modern Shopping Experience')).toBeInTheDocument();
  });

  it('renders no interactive elements while the intro plays', () => {
    renderGate('/');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('auto-advances: holds for the full timeline, exits, then unmounts', () => {
    renderGate('/');
    expect(heading()).toBeInTheDocument();

    // Not done early: still up at 3.9s.
    tick(INTRO_HOLD_MS - 100);
    expect(heading()).toBeInTheDocument();

    // Exit phase: overlay still mounted (fading out)…
    tick(100);
    expect(heading()).toBeInTheDocument();

    // …then gone, with no user action whatsoever.
    tick(INTRO_EXIT_MS);
    expect(heading()).not.toBeInTheDocument();
  });

  it('marks the intro as seen at mount, so it cannot replay in this session', () => {
    const first = renderGate('/');
    expect(sessionStorage.getItem(SESSION_FLAG)).toBe('1');
    first.unmount();

    // A fresh mount in the same session must skip it entirely.
    renderGate('/');
    expect(heading()).not.toBeInTheDocument();
  });

  it('never shows on deep links', () => {
    renderGate('/cart');
    expect(heading()).not.toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_FLAG)).toBeNull();
  });

  it('skips the intro for Lighthouse or bot user agents', () => {
    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 Chrome-Lighthouse',
      configurable: true,
    });
    renderGate('/');
    expect(heading()).not.toBeInTheDocument();
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUa,
      configurable: true,
    });
  });

  it('shortens to a static hold under prefers-reduced-motion', () => {
    window.matchMedia = reducedMotionMatchMedia;
    renderGate('/');
    expect(heading()).toBeInTheDocument();

    tick(REDUCED_HOLD_MS - 100);
    expect(heading()).toBeInTheDocument();

    // Hold ends here…
    tick(100);
    expect(heading()).toBeInTheDocument();

    // …and the (animation-less) 0ms exit resolves on the next tick.
    tick(10);
    expect(heading()).not.toBeInTheDocument();

    // The full cinematic timeline must not have been used.
    expect(REDUCED_HOLD_MS).toBeLessThan(INTRO_HOLD_MS);
  });

  it('locks the background (inert + no scroll) and releases both afterwards', () => {
    const { shell, unmount } = renderGate('/');

    expect(shell.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(shell.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('lets go of the shell if the route changes mid-intro', () => {
    const GoCart = () => {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate('/cart')}>go-cart</button>;
    };
    render(
      <MemoryRouter initialEntries={['/']}>
        <div data-app-shell><span>store</span></div>
        <GoCart />
        <IntroGate />
      </MemoryRouter>
    );
    const shell = document.querySelector('[data-app-shell]');

    expect(heading()).toBeInTheDocument();
    expect(shell.hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'go-cart' }));

    expect(heading()).not.toBeInTheDocument();
    expect(shell.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
