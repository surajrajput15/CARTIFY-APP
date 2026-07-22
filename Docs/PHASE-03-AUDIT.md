# Production Readiness Audit — Phase 3 Backlog

## Cartify MERN E-Commerce Platform

---

## Classification Legend

| Icon | Meaning |
|------|---------|
| 🔴 Critical Bug | Broken behavior or security issue that must be fixed before release |
| 🟡 Improvement | Feature already works but can be improved |
| 🔵 Future Feature | Not required for Phase 3, move to future phase |
| ❓ Needs Verification | Requires further inspection to confirm |

---

## Sprint 1 — Security & Error Handling Foundation

| Category | Finding | Priority | Location | Action |
|---|---|---|---|---|
| 🔴 Security | JWT_SECRET is weak dictionary word (`surajbhanpratapsinghcartifyApp`) — token forgery risk | P0 | Backend `.env` / `middleware/auth.js:10` | Generate cryptographically strong secret via `crypto.randomBytes(32).toString('hex')` |
| 🔴 Security | `helmet()` not installed — zero HTTP security headers (CSP, HSTS, X-Frame-Options) | P0 | `Backend/server.js` | Install `helmet` package and apply `app.use(helmet())` before all routes |
| 🔴 Security | CORS is open: `app.use(cors())` with no origin restriction | P0 | `Backend/server.js:45` | Restrict to `https://cartify-hub.vercel.app` and localhost |
| 🔴 Security | Google OAuth Client ID hardcoded in `main.jsx:14` — exposed credential in public repo | P0 | `Frontend/src/main.jsx:14` | Move to `VITE_GOOGLE_CLIENT_ID` env var |
| 🔴 Security | Error objects (stack traces) leaked to client | P0 | `productRoutes.js:46,57,70,80,90`, `orderRoutes.js:25,38,52` | Remove `error` from all `res.json()` responses; never expose stack traces |
| 🔴 Security | OTP generated with `Math.random()` instead of `crypto.randomInt()` | P0 | `Backend/routes/authRoutes.js:27,145` | Replace with `crypto.randomInt(100000, 999999).toString()` |
| 🔴 Security | Price manipulation risk — client sends `amount` in payment without server-side verification | P0 | `Backend/routes/paymentRoutes.js:17` | Calculate total server-side from cart items instead of trusting client |
| 🔴 Security | User input interpolated directly into `$regex` search — ReDoS vulnerability | P1 | `Backend/routes/productRoutes.js:13` | Escape/sanitize search input before passing to `$regex`; add regex timeout |
| 🔴 Security | First-user-becomes-admin via `userCount === 0` — race condition | P1 | `Backend/routes/authRoutes.js:23,99,249` | Use `findOneAndUpdate` with atomic operation or admin creation endpoint |
| 🔴 Error Handling | No global Express error-handling middleware (`err, req, res, next`) | P1 | `Backend/server.js` | Add centralized error handler; wrap async routes with `express-async-errors` |
| 🔴 Error Handling | All frontend `catch` blocks only call `console.error()` — user sees blank page on API failure | P1 | `HomePage.jsx:38`, `ProfilePage`, `AdminPage`, `CheckoutPage` | Replace with `toast.error()` calls in every catch block |
| 🔴 UX | No 404 route — unmatched URLs render blank page | P1 | `Frontend/src/App.jsx` | Add `<Route path="*" element={<NotFound />} />` |
| 🔴 UX | Cart badge shows `cart.length` (item types) not total quantity | P2 | `Frontend/src/components/Navbar.jsx:107` | Change to `cart.reduce((sum, i) => sum + (i.quantity || 1), 0)` |
| 🔴 Mobile | Admin product table has no horizontal scroll on sub-768px screens | P2 | `Frontend/src/pages/AdminPage.jsx` | Wrap table in `overflow-x-auto` container |
| 🔴 Infrastructure | Uploaded images stored on Render's ephemeral disk — lost on every restart | P1 | `Backend/routes/uploadRoutes.js` | Migrate to Cloudinary or AWS S3 for persistent storage |
| 🔴 a11y | Desktop search submit button has no `aria-label` — screen reader users cannot use search | P2 | `Frontend/src/components/Navbar.jsx:49,128` | Add `aria-label="Search"` to both search submit buttons |
| 🔴 a11y | Rating star icon is purely visual — no accessible text for screen readers | P2 | `Frontend/src/components/ProductCard.jsx:34` | Add `role="img" aria-label={`${rating} out of 5 stars`}` |

---

## Sprint 2 — UX, Code Quality & Mobile

| Category | Finding | Priority | Location | Action |
|---|---|---|---|---|
| 🟡 UX | `react-hot-toast` imported and `<Toaster>` rendered but `toast()` is never called | Medium | `Frontend/src/App.jsx:6,18` | Replace all `alert()` with `toast.success/error()` across all pages |
| 🟡 UX | `alert()` / `window.confirm()` used for all admin actions — blocking, no undo | Medium | `Frontend/src/pages/AdminPage.jsx` | Use modal component + toast with undo option |
| 🟡 UX | Login redirect always goes to `/` — loses pre-login context | Medium | `Frontend/src/pages/LoginPage.jsx` | Save intended path in `sessionStorage` before login redirect |
| 🟡 Performance | Dead code in bundle: `data/products.js`, `hero.png`, `react-hot-toast` | Medium | Various | Remove unused files: `src/data/products.js`, `src/assets/hero.png`, uninstall `react-hot-toast` |
| 🟡 Performance | No `loading="lazy"` on product card images | Medium | `Frontend/src/components/ProductCard.jsx:17` | Add `loading="lazy"` attribute to `<img>` |
| 🟡 Error Handling | Axios 401 interceptor uses `window.location.href` — full page reload | Medium | `Frontend/src/api/axios.js:24` | Use `navigate('/login')` from React Router instead |
| 🟡 Code Quality | Mixed Hindi/English comments throughout source code | Low | Multiple files | Translate all comments to English for consistency |
| 🟡 Code Quality | ESLint missing `react/*` rules — only `react-hooks` and `react-refresh` configured | Low | `Frontend/eslint.config.js` | Add `eslint-plugin-react` with recommended rules |
| 🟡 Code Quality | `tailwind.config.js` v3 format with v4 `@import` syntax — dormant mismatch | Low | `Frontend/tailwind.config.js` | Migrate to Tailwind v4 CSS-first config or confirm compat |
| 🟡 Code Quality | Two sources of truth for defaults: `config.js` fallbacks duplicate `.env.example` | Low | `Frontend/src/config.js` | Remove fallback defaults; rely solely on `.env` |
| 🟡 Maintainability | Duplicate order routes: `POST /create` and `POST /add` | Medium | `Backend/routes/orderRoutes.js:7,43` | Remove `/create` route; frontend uses only `/add` |
| 🟡 Scalability | No MongoDB indexes on `Product.title`, `Order.userId`, `Address.userId` | Medium | Backend models | Add indexes for frequently queried fields |
| 🟡 Scalability | Rate limit of 100 req/min may throttle legitimate users during traffic | Low | `Backend/server.js:32` | Increase to per-IP limit of 200 req/min with burst of 300 |
| 🟡 a11y | Icon-only buttons (Admin, Logout, Cart) lack `aria-label` | Medium | `Frontend/src/components/Navbar.jsx:79,86,102` | Add `aria-label` to all icon-only `<Link>` and `<button>` elements |

---

## Sprint 3 — Performance, a11y & Polish

| Category | Finding | Priority | Location | Action |
|---|---|---|---|---|
| 🟡 Performance | No React.lazy/Suspense code splitting — all 7 pages in one bundle | Low | `Frontend/src/App.jsx` | Wrap page imports with `React.lazy()` and `<Suspense>` |
| 🟡 Code Quality | `item._id \|\| item.id` pattern duplicated across cart — fragile | Medium | `Frontend/src/context/cartContext.jsx` | Normalize ID to `_id` in API response; use consistent field |
| 🟡 Code Quality | No PropTypes or TypeScript — zero type safety | Low | Entire frontend | Add PropTypes to all components incrementally |
| 🟡 Maintainability | No API service layer — inline axios calls in every page | Low | All pages | Extract API functions into `src/api/services.js` |
| 🟡 Error Handling | No `unhandledrejection` / `error` event listeners on frontend | Low | `Frontend/src/main.jsx` | Add global error event listeners |
| 🟡 Security | No request body size limit on `express.json()` | Low | `Backend/server.js:46` | Add `express.json({ limit: '10kb' })` |
| 🟡 Security | JWT stored in localStorage (XSS-vulnerable) vs HttpOnly cookies | Low | `Frontend/src/context/authContext.jsx` | Document trade-off; consider migration in future |
| 🟡 Scalability | No `Cache-Control` headers on API responses | Low | `Backend/routes/productRoutes.js` | Add `res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')` |
| 🟡 a11y | No `skip-to-content` link for keyboard/screen reader users | Low | `Frontend/src/App.jsx` or `index.html` | Add first-focusable skip link before `<Navbar>` |
| 🟡 a11y | Admin "Add Product" modal lacks focus trap | Low | `Frontend/src/pages/AdminPage.jsx` | Implement focus trap with `aria-modal="true"` |
| 🟡 a11y | No `aria-live` region for dynamic content (errors, toasts) | Low | `Frontend/src/App.jsx` | Add `aria-live="polite"` to toast container |
| 🟡 Maintainability | No `.editorconfig` for consistent formatting | Low | Project root | Add `.editorconfig` file |

---

## Phase 4 — Future Features

| Category | Finding | Priority | Location | Notes |
|---|---|---|---|---|
| 🔵 Quality | Zero tests — no test runner, no test files | Low | Entire project | Requires vitest + React Testing Library setup |
| 🔵 Scalability | Cart is client-only (localStorage) — no server-side sync; cart lost on device switch | Medium | `Frontend/src/context/cartContext.jsx` | Requires new API endpoints + merge-on-login logic |

---

## Needs Verification

| Category | Finding | Reason |
|---|---|---|
| ❓ a11y | Touch targets on CTA buttons not measured against 44x44px WCAG minimum | Need to inspect actual CSS dimensions on button elements |
| ❓ a11y | Color contrast of text/background combinations not checked against WCAG AA (4.5:1) | Need to compute contrast ratios with color contrast checker |

---

*Generated from production readiness audit — July 2026*
