// Dev-gated logger — loud during development, silent in production builds.
// Use this in catch paths and hooks instead of raw console.* so the prod
// console stays clean. ErrorBoundary components and global window handlers
// keep their direct console calls (they only fire on real crashes).
const isDev = import.meta.env.DEV;

export const logError = (...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export const logWarn = (...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
};
