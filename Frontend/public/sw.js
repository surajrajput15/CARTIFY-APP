/* Cartify Service Worker — v2 */
const CACHE_PREFIX = 'cartify';
const CACHE_VERSION = 'v2';
const APP_SHELL = 'cartify-shell';
const ASSET_CACHE = 'cartify-assets';
const IMAGE_CACHE = 'cartify-images';
const API_CACHE = 'cartify-api';

const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];

const API_ROUTES_TO_CACHE = [
  '/api/products',
  '/api/auth/me',
  '/api/cart',
  '/api/orders',
  '/api/addresses',
];

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/i.test(url.pathname);
}

function isApiRequest(url) {
  return API_ROUTES_TO_CACHE.some((route) => url.pathname.startsWith(route));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !key.includes(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(APP_SHELL).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isSameOrigin(request) && isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              const target = url.pathname.startsWith('/icons/') || /\.(png|jpe?g|gif|webp|avif|ico)$/i.test(url.pathname) ? IMAGE_CACHE : ASSET_CACHE;
              caches.open(target).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  if (isSameOrigin(request) && isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
