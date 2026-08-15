# Changelog

## Phase 1

Frontend completed.

---

## Phase 2

Backend integrated.

---

## Phase 3

Production hardening, security audit, payment lifecycle, deployment.

---

## Phase 4

- Automated unit tests (Vitest) — 24 tests across utils, cart & image resolution
- Server-side cart sync + merge-on-login (cross-device persistence)
- Cloudinary image storage with local fallback
- a11y: focus-trapped modals, skip-to-content, aria-live toasts, labeled icon links
- Login redirect context preserved; 401 redirect via client-side navigation
- Removed dead assets, stale Tailwind v3 config, duplicate config fallback
- eslint-plugin-react rules; rate limit raised to 200/min; API cache headers