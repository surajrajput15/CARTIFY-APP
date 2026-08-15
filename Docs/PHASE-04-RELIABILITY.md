# Phase 4 — QA & Reliability

## Status: Complete ✅

Phase 4 closes the remaining audit backlog and adds reliability-focused capability
to the v1.0.x baseline. It is NOT a new product version — these changes ship inside
v1.0.x maintenance releases.

---

## 1. Automated Testing (Vitest)

| Item | Detail |
|------|--------|
| Runner | Vitest + jsdom |
| Scripts | `npm test` (run once), `npm run test:watch` |
| Test files | `src/**/*.test.{js,jsx}` |

**Coverage:**

- `utils/passwordStrength.test.js` — password scoring logic
- `utils/products.test.js` — search/filter/category logic
- `utils/stockStatus.test.js` — In/Low/Out of Stock states
- `utils/imageUrl.test.js` — local vs remote image resolution
- `context/cartContext.test.jsx` — add/remove/update/clear cart behaviour

**Status:** 24 tests across 5 files — all passing.

---

## 2. Server-Side Cart Sync

Previously the cart lived only in `localStorage`, so it vanished on device switch.
Now it syncs to the backend:

| API | Purpose |
|-----|---------|
| `GET /api/cart` | Fetch saved cart (enriched with live product data) |
| `POST /api/cart/merge` | Merge guest cart into server cart on login |
| `PUT /api/cart` | Replace server cart after local mutations |
| `DELETE /api/cart` | Clear server cart after order placement |

**Behaviour:**

- Guest adds items → logs in → local cart is merged into the server cart.
- Every subsequent cart change (debounced) is pushed to the server.
- A user's cart now persists across devices.
- Clear-cart (after payment) also clears the server copy so placed items don't reappear.

**Files:** `Backend/models/Cart.js`, `Backend/routes/cartRoutes.js`,
`Frontend/src/services/cartApi.js`, `Frontend/src/context/cartContext.jsx`.

---

## 3. Cloudinary Image Storage

Uploaded images previously lived on Render's ephemeral disk and were lost on every
restart. Uploads now use Cloudinary when configured:

- Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to
  the backend `.env` (see `.env.example`).
- When present → images upload to Cloudinary (persistent, CDN-backed).
- When absent → fall back to local disk (development only).

Product deletion/update also cleans up the Cloudinary asset or local file behind
the old image URL.

---

## 4. Accessibility (a11y) Hardening

- Skip-to-content link before the navbar.
- Reusable focus-trapped modal (`Modal.jsx`) with `role="dialog"` + `aria-modal`
  for all dialogs (Add/Edit Product, Confirm actions).
- `aria-live` region on the toast container.
- `aria-label` on icon-only Cart / Profile / search links.
- Global `unhandledrejection` / `error` listeners surface silent failures.

---

## 5. UX Improvements

- Login redirect preserved: the intended page (e.g. `/checkout`) is restored after
  login instead of always going to `/`.
- 401 responses now redirect via client-side navigation (no full page reload).
- Admin refund confirmation uses a modal instead of `window.confirm()`.

---

## 6. Backend & Housekeeping

- `Cache-Control` headers on product list/detail responses.
- General rate limit raised from 100 → 200 req/min.
- Hinglish comments and API messages translated to English.
- Removed dead assets (`hero.png`, `react.svg`, `vite.svg`), stale Tailwind v3
  config, and duplicate config fallback (single source of truth in `.env`).
- `eslint-plugin-react` rules added; `.editorconfig` added; `.env` gitignore
  hardened for the frontend.

---

## Verification

- ✅ `npm run lint` — clean
- ✅ `npm run build` — production build passes
- ✅ `npm test` — 24/24 tests pass
- ✅ Backend `node --check` on all modified files