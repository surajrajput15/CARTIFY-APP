// Build-time version constant. We hardcode the version here so the bundler
// can resolve it at compile time. Update this when bumping the version.
// (Vite exposes import.meta.env.VITE_APP_VERSION, but we keep a fallback.)
const envVersion = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION;

export const PACKAGE_VERSION = envVersion || '1.0.0';
export const BUILD_TIME = new Date().toISOString();