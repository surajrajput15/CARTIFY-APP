// PWA helpers: service worker registration and install-prompt handling.
//
// The install prompt is a one-shot browser event (Chrome/Edge/Android). We
// capture it the first time it fires and expose a trigger so a component can
// show an "Install App" button whenever the browser allows it.

let deferredPrompt = null;
const canInstallListeners = new Set();
let listenersAttached = false;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

export function listenForInstallPrompt() {
  if (!('beforeinstallprompt' in window)) return;
  if (listenersAttached) return;
  listenersAttached = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    canInstallListeners.forEach((fn) => fn(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    canInstallListeners.forEach((fn) => fn(false));
  });
}

export const canInstall = () => deferredPrompt !== null;

export function subscribeCanInstall(fn) {
  canInstallListeners.add(fn);
  return () => canInstallListeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  canInstallListeners.forEach((fn) => fn(false));
  return choice.outcome === 'accepted';
}

export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;