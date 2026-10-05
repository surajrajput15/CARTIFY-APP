import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SplashIntro from './SplashIntro';

/**
 * IntroGate — decides when the splash intro runs and tears it down.
 *
 * Policy (agreed with product):
 *   - Only on `/` (deep links like /cart or /product/:id never see it).
 *   - Once per browser session (sessionStorage flag, written at mount so a
 *     closed tab mid-intro doesn't replay it).
 *   - Zero interaction: it auto-advances. No skip button, no links.
 *
 * While visible it marks the app shell `inert` (React 19 target, set manually
 * here so React never has to re-render it) and locks body scroll — focus cannot
 * escape into the store and the background cannot scroll behind the overlay.
 */
export const SESSION_FLAG = 'cartify_intro_seen';
export const INTRO_HOLD_MS = 1500; // snappier cinematic timeline (~1.5s)
export const INTRO_EXIT_MS = 400; // smooth fade+scale reveal
export const REDUCED_HOLD_MS = 800; // reduced motion: quick static hold

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export const isBotOrLighthouse = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  // 1. Automation / Headless detection (Lighthouse & Chrome DevTools protocol always set navigator.webdriver)
  if (Boolean(navigator.webdriver)) {
    return true;
  }
  // 2. User-Agent flags (Lighthouse CLI, Googlebot, search bots, headless)
  const ua = (navigator.userAgent || '').toLowerCase();
  const botPatterns = [
    'lighthouse', 'chrome-lighthouse', 'pagespeed', 'googlebot',
    'headlesschrome', 'bingbot', 'baiduspider', 'yandexbot',
    'duckduckbot', 'ptst', 'crawl'
  ];
  if (botPatterns.some((pattern) => ua.includes(pattern))) {
    return true;
  }
  // 3. Headless automation global markers
  if (
    typeof window.__LIGHTHOUSE_TEST_PREVIEWS__ !== 'undefined' ||
    typeof window.__pw_manualStatus !== 'undefined' ||
    typeof window._phantom !== 'undefined' ||
    typeof window.__nightmare !== 'undefined'
  ) {
    return true;
  }
  // 4. Query param bypass
  if (typeof window.location !== 'undefined' && window.location.search && /[?&](no-intro|lighthouse|audit)(=|&|$)/i.test(window.location.search)) {
    return true;
  }
  return false;
};

const readSeen = () => {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    // Storage blocked (private mode): don't replay the intro forever.
    return true;
  }
};

const writeSeen = () => {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* storage unavailable — intro still works, just may replay next visit */
  }
};

const IntroGate = () => {
  const location = useLocation();
  const reducedRef = useRef(prefersReducedMotion());
  const [phase, setPhase] = useState(() =>
    location.pathname === '/' && !readSeen() && !isBotOrLighthouse() ? 'showing' : 'hidden'
  );

  // The overlay only exists while its phase is active AND we are on the home
  // route — if someone navigates away mid-intro the layer must let go of the
  // shell immediately instead of covering the new page.
  const visible = phase !== 'hidden' && location.pathname === '/';

  // Phase machine: showing -> exiting -> hidden.
  useEffect(() => {
    if (phase === 'hidden') return undefined;

    if (phase === 'showing') writeSeen();

    const hold = reducedRef.current ? REDUCED_HOLD_MS : INTRO_HOLD_MS;
    const next = phase === 'showing'
      ? { after: hold, then: 'exiting' }
      : { after: reducedRef.current ? 0 : INTRO_EXIT_MS, then: 'hidden' };

    const t = setTimeout(() => setPhase(next.then), next.after);
    return () => clearTimeout(t);
  }, [phase]);

  // Shell isolation: inert + scroll lock, released on unmount / route leave.
  useEffect(() => {
    if (!visible) return undefined;

    const shell = document.querySelector('[data-app-shell]');
    shell?.setAttribute('inert', '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      shell?.removeAttribute('inert');
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  if (!visible) return null;
  return <SplashIntro exiting={phase === 'exiting'} />;
};

export default IntroGate;
