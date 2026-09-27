// F-54: the badge must reflect package.json — not a second hardcoded copy.
// VITE_APP_VERSION still wins when a release pipeline sets it.
import pkg from '../package.json';

const envVersion = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION;

export const PACKAGE_VERSION = envVersion || pkg.version;