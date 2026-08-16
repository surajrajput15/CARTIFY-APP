# Cartify — Progress Report

> Status: 16 August 2026 · Branch `main` · 62 commits · Working tree clean

---

## Summary

| Milestone | Status | Notes |
|---|---|---|
| Phase 1 — Frontend UI | ✅ Complete | React 19 + Vite 8 + Tailwind 4 |
| Phase 2 — Full Stack Integration | ✅ Complete | MERN: Node/Express + MongoDB Atlas |
| Phase 3 — Engineering for Production | ✅ Complete | Security, payment lifecycle, deploy |
| Phase 4 — QA & Reliability | ✅ Complete | Tests, cart sync, Cloudinary, a11y |
| **Phase 5 — Upcoming** | ⏳ Not started | See Roadmap |
| **Phase 6 — Upcoming** | ⏳ Not started | See Roadmap |

**Overall project progress: ~100% of the planned v1.0.x scope (Phases 1–4) is complete and deployed live.**

---

## Phase-by-Phase

### ✅ Phase 1 — Frontend UI

- Product catalog (grid, category filter, search, pagination 12/page)
- Product details, shopping cart, checkout UI
- Login (password / OTP / Google), profile dashboard, admin panel
- Responsive mobile-first design with Tailwind CSS 4

### ✅ Phase 2 — Full Stack Integration

- REST API on Node.js + Express, MongoDB (Mongoose 9)
- Authentication: JWT + bcrypt, OTP passwordless, Google OAuth
- Razorpay payments (test mode), admin product management
- Deployed: Vercel (frontend) + Render (backend) + MongoDB Atlas

### ✅ Phase 3 — Engineering for Production

Delivered through 3 sprints:

| Sprint | Name | Status |
|---|---|---|
| Sprint 1 | Security Foundation | ✅ Complete (5 days) |
| Sprint 2 | Production Polish & UX | ✅ Complete (5 days) |
| Sprint 3 | Performance & Architecture | ✅ Complete (100%) |

**Sprint 1 — Security Foundation:** Helmet, CORS allowlist, env validation,
`crypto.randomInt()` OTPs, server-side pricing, HMAC payment verification,
ReDoS sanitisation, rate limiting, secure receipt generation.

**Sprint 2 — Production Polish & UX:** Critical bug fixes (product page loading,
auth refresh, profile sync), toasts + modals replacing `alert()`/`confirm()`,
server-side price verification, PATCH product API with admin middleware,
lazy images, a11y labels, SEO meta/OG/Twitter tags. Audit result:
0 critical / 0 high / 0 medium blocking / 3 low non-blocking.

**Sprint 3 — Performance & Architecture:** Route-based code splitting
(`React.lazy` + `Suspense`), global ErrorBoundary, API service layer, custom
hooks, memoization audit, server-authoritative Razorpay lifecycle
(single Pending→Paid order, idempotent + atomic + replay-safe verification,
client price/state trust removed, duplicate orders eliminated), Google OAuth
server-side ID token verification, automatic admin escalation removed.

### ✅ Phase 4 — QA & Reliability

- **24 automated tests / 5 files (Vitest + jsdom)** — utils + cart logic
- **Server-side cart sync** — merge-on-login, cross-device persistence
- **Cloudinary image storage** — env-flagged, local disk fallback
- **a11y hardening** — skip link, focus-trapped modals, aria-live toasts,
  labeled icon links, global error listeners
- **UX** — preserved login redirect, client-side 401 redirect
- **Housekeeping** — cache headers, rate limit 200/min, dead asset removal,
  ESLint React rules, `.editorconfig`, `.env` gitignore hardening

---

## Post-Phase-4 Fixes (v1.0.x maintenance — current session)

These shipped after Phase 4 as maintenance releases on `main`:

| Commit | Fix |
|---|---|
| `a28f75a` | Google sign-in switched to GIS **popup mode** for static SPA hosting (fixes `redirect_uri_mismatch`) |
| `4e91257` | `.npmrc` `legacy-peer-deps` — unblocks Vercel install (eslint 10 vs plugin peer conflict) |
| `47b0552` | Repaired malformed `vercel.json` that blocked every Vercel build |
| `296bcfb` | CSP expanded for Razorpay checkout/API/analytics + Google GSI stylesheet |
| `05e8e41` | Google sign-in switched to GIS **redirect mode** (popup silently failed on non-Chrome/mobile & in-app browsers); token delivered via URL fragment + `accounts.google.com/gsi/` added to `connect-src` CSP |
| `c037197` | Added Vercel function `api/google-auth` as the GIS `login_uri` — Google's redirect POST (which the static SPA answered with 405) is now bounced back to `/login#id_token=...` and exchanged with the backend. Google login now works on all browsers (laptop + mobile) |

**Verified live:** CSP headers active, Google login working on all browsers,
Razorpay checkout working. `npm run lint` clean, `npm test` 24/24 passing.

---

## Sprints Summary

| Sprint | Duration | Deliverable | Status |
|---|---|---|---|
| Sprint 1 | 5 working days | Security & error-handling foundation | ✅ Complete |
| Sprint 2 | 5 working days | Production polish, UX, accessibility, SEO | ✅ Complete |
| Sprint 3 | ~4 working days | Architecture, auth hardening, server-authoritative payments | ✅ Complete (100%) |

---

## Known Bugs

Per `Docs/BUGS.md`: **no confirmed bugs outstanding.** All audit findings are
resolved or tracked as future features.

---

## Pending / Future

- Phase 5 & Phase 6 — **not started** (Roadmap lists no detail yet)
- Stale README notes (non-blocking): `@react-oauth/google` listed in tech stack
  while the app now uses GIS directly; "Google OAuth requires GOOGLE_CLIENT_ID
  on Render" — this is set and login is verified working; `robots.txt` / SEO
  and localStorage JWT caveats remain documented trade-offs

---

## Deployment Status

| Component | Value | Status |
|---|---|---|
| Frontend | https://cartify-hub.vercel.app | ✅ Live |
| Backend | https://cartify-api-10g3.onrender.com | ✅ Live |
| Database | MongoDB Atlas | ✅ Connected |
| Payments | Razorpay (test mode) | ✅ Working |
| Google Login | Server-side ID token verification | ✅ Working |