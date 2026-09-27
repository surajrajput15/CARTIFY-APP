// Dev-gated logger — loud during development, silent in production builds.
// Use this in catch paths and hooks instead of raw console.* so the prod
// console stays clean. ErrorBoundary components and global window handlers
// keep their direct console calls (they only fire on real crashes).
const isDev = import.meta.env.DEV;

export const logError = (...args) => {
  if (isDev) {
    console.error(...args);
  }
};

export const logWarn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};

// Debug-level chatter (payment options, fetch results). Never ships to prod
// so PII (emails, cart contents) can't leak into a production console.
export const logDebug = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};
