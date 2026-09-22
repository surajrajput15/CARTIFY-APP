# Cartify — Frontend Deep Audit TODOs

**Source:** Frontend deep audit (all 65 files under `Frontend/src` + backend contract cross-check)
**Baseline:** branch `main` at commit `66ed0c4` + uncommitted address work in the working tree
**Scope:** `Frontend/` only, except where a frontend fix depends on a backend contract answer
**Total tasks:** 58 across 7 phases — 4 × P0, 9 × P1, 33 × P2, 12 × P3

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## 0. Blocking decisions (answer before Phase 1)

### DEC-1 · Shipping rule (blocks F-02)

`Frontend/src/utils/constants.js` defines `STANDARD_SHIPPING_COST = 79` and
`FREE_SHIPPING_THRESHOLD = 999`. `CartPage` and `OrderSummary` **add ₹79 to the displayed
total**. `Backend/routes/paymentRoutes.js` has **no shipping concept at all**
(`calculatedTotal = Σ(price × qty) − discount`), and Razorpay is charged
`Math.round(order.totalPrice * 100)`. Every sub-₹999 order therefore **displays more than it
charges**.

- [ ] **DEC-1A (recommended)** Remove the fee from the display. Keep "free shipping over ₹999"
      as marketing copy only. Render the CTA amount from the server response.
- [ ] **DEC-1B** Implement shipping server-side (`paymentRoutes.js` + `Order` model + refund
      math + order-history display) so the charge matches the display.

### DEC-2 · Logout cart policy (blocks F-03)

`CartProvider` keeps `cart` and `localStorage['cart']` after logout, so the next user's login
**merges the previous user's items** into their server cart.

- [ ] **DEC-2A (recommended)** Discard the local cart on logout.
- [ ] **DEC-2B** Keep it for the same user; discard only when a *different* user id logs in.

### DEC-3 · Uncommitted address work (blocks F-01)

`Frontend/src/hooks/useAddresses.js`, `Frontend/src/components/profile/AddressManager.jsx` and
`Frontend/src/services/addressesApi.js` have uncommitted changes that contain a P0 data bug
(F-01). Confirm this work is in scope for this pass.

### DEC-4 · TypeScript strategy (blocks F-50)

`npm run typecheck` currently checks nothing (`tsconfig.json` has no `allowJs`, and
`src/types/index.ts` is imported by zero files). Choose: adopt types incrementally, or remove
the CI step so it stops giving false assurance.

---

## Phase 1 — Critical bugs (P0)

> **Definition of Done:** `npm run lint` and `npm run test` pass; manual walk-through of
> guest → login → logout → second login proves no cross-user data leak; no screen shows an
> amount that differs from what Razorpay charges.

- [ ] **F-01 · Deleted address reappears** — P0 · data integrity
  - **File:** `Frontend/src/hooks/useAddresses.js` → `fetchAddresses` (~line 22, uncommitted)
  - **Problem:** `setAddresses((prev) => response.data.length > 0 ? response.data : prev)`.
    When the last address is deleted the refetch returns `[]`, the empty result is discarded, and
    the deleted address stays on screen until a hard reload.
  - **Fix:** always adopt the server list (`setAddresses(response.data)`). Solve the race it was
    guarding against with a request-sequence token (`requestIdRef`) or an `AbortController` —
    never by discarding a legitimate empty result.
  - **Acceptance:** deleting the last address empties the list immediately; a slow in-flight
    response cannot overwrite newer data; `AddressSelector` shows its empty state after the last
    delete.
  - **Tests:** new `src/hooks/useAddresses.test.js` — "empties the list when the last address is
    deleted"; "an out-of-order stale response does not clobber newer data" (mock `addressesApi`).

- [ ] **F-02 · Displayed total ≠ charged total** — P0 · money
  - **Files:** `Frontend/src/utils/constants.js`, `Frontend/src/pages/CartPage.jsx`,
    `Frontend/src/components/checkout/OrderSummary.jsx` (`getShippingCost`)
  - **Problem:** see DEC-1.
  - **Fix (DEC-1A):** remove `getShippingCost` from the money path in `CartPage` and
    `OrderSummary`; `finalTotal = discountedSubtotal`; turn the "Shipping" row into a
    non-monetary "Free delivery on orders over ₹999" note; keep the button label in sync with the
    amount the backend will charge.
  - **Fix (DEC-1B):** add shipping in `paymentRoutes.js` after the coupon step, persist it on the
    `Order` (`shippingCost`), include it in the verify-amount check and refund math, and read it
    back in `OrdersTab` and `AdminOrdersTab`.
  - **Acceptance:** for a ₹500 cart the summary, the CTA label and the Razorpay modal all agree;
    no currency value is computed only on the client.
  - **Tests:** `OrderSummary.test.jsx` — "total equals subtotal when shipping is not charged";
    `useRazorpayPayment.test.js` — "CTA amount matches `order.calculatedAmount`".
  - **Verify when done:** `grep -rn "getShippingCost" Frontend/src` returns only the informational
    helper, never a total calculation.

- [ ] **F-03 · Cross-user cart leak on login** — P0 · privacy
  - **Files:** `Frontend/src/context/cartContext.jsx` (auth effect ~lines 66–98),
    `Frontend/src/context/authContext.jsx`
  - **Problem:** on logout `user` becomes `null`, but the effect only resets `syncedUserRef` and
    `loggedInAtMountRef`. `cart` and `localStorage['cart']` survive, so the next user's
    `loggedInAtMountRef.current === false` triggers `mergeCart(previousUserItems)`.
  - **Fix:** on the `user → null` transition, `setCart([])`, `localStorage.removeItem('cart')`,
    cancel both debounce timers, and reset both refs. Keep the reload-while-logged-in path
    (`loggedInAtMountRef === true` → `fetchCart()` as authoritative) working.
  - **Acceptance:** user A adds 3 items → logs out → user B logs in → B's badge is 0 and B's
    server cart contains none of A's items; A's reload-while-logged-in still restores A's cart
    from the server.
  - **Tests:** new `src/context/cartContext.test.jsx` — "clears cart on logout"; "does not merge a
    previous user's items into a new user's cart"; "restores the server cart on reload while
    logged in".

- [ ] **F-04 · Coupon leaks to the next user** — P0 · money (ships with F-03)
  - **File:** `Frontend/src/hooks/useCoupon.js` (`STORAGE_KEY = 'cartify_coupon_code'`)
  - **Problem:** the coupon code is persisted in `localStorage`, and its "clear when the cart
    empties" guard never fires on logout (the cart is not emptied). The next user inherits the
    code and possibly a pre-applied discount.
  - **Fix:** clear coupon state + storage on logout (piggyback the F-03 transition); remove the
    storage key when the owner changes; keep the empty-cart guard.
  - **Acceptance:** after a logout/login cycle no coupon is pre-filled and `localStorage` has no
    `cartify_coupon_code`.
  - **Tests:** `useCoupon.test.js` — "clears the persisted code on logout"; "does not auto-apply a
    stored code for a different user".

- [ ] **F-05 · CI lint is red — deploy is blocked** — P0 · pipeline
  - **Files:** `Frontend/src/hooks/useAddresses.js:73`,
    `Frontend/src/pages/ProductDetailsPage.jsx:18`
  - **Problem:** `npm run lint` fails with 6 `no-unused-vars` errors, so
    `Frontend/.github/workflows/ci.yml` never reaches its `build` / `deploy` jobs.
  - **Fix:** remove the unused `PLACEHOLDER_IMG` from `ProductDetailsPage.jsx` (F-26 replaces it
    with a shared constant) and drop the unused destructured aliases in `useAddresses.js` — or set
    `ignoreRestSiblings` in `eslint.config.js` if the omit-idiom is intentional.
  - **Acceptance:** `cd Frontend && npm run lint` exits 0.
  - **Verify:** the job must be green *before* any other task is marked done.

**Phase 1 verification**
```bash
cd Frontend && npm run lint && npm run test
```

---

## Phase 2 — User-flow correctness

> **DoD:** every step of Home → discovery → search → category → product → cart → login →
> address → checkout → pay → confirmation → order history → order details survives Back,
> refresh, direct URL, double-click, API failure and expired session.

- [ ] **F-06 · Add-to-cart gives no feedback** — P1 ·
  `Frontend/src/components/ProductCard.jsx` → `handleAddToCart` only calls `addToCart`.
  Add a success toast plus a short button state (reuse the PDP pattern and the existing
  `react-hot-toast`) and an accessible `aria-live` confirmation.
  *Tests:* new `ProductCard.test.jsx` (zero coverage today).

- [ ] **F-07 · Admin status transitions disagree with the API** — P1 ·
  `Frontend/src/components/admin/AdminOrdersTab.jsx` `LEGAL_TRANSITIONS` vs
  `Backend/routes/orderRoutes.js` `ALLOWED_TRANSITIONS`. The UI offers `Pending → Shipped`
  (server returns 400) and hides the valid `Shipped → Cancelled`.
  *Fix:* mirror the backend map exactly and add a comment naming the backend file as the source
  of truth. *Tests:* assert the `<option>` set rendered for each status.

- [ ] **F-08 · Post-payment empty checkout** — P2 · `Frontend/src/pages/CheckoutPage.jsx`.
  The `orderJustPlaced` early-return renders a checkout with a ₹0 subtotal and a **₹79** total.
  *Fix:* on payment success navigate to `/profile?tab=orders`; always bounce an empty cart to
  `/cart`; remove the `orderJustPlaced` flag and its `sessionStorage` choreography.

- [ ] **F-09 · Pay button can double-fire** — P2 · `Frontend/src/hooks/useRazorpayPayment.js`.
  `setLoading(true)` is async, so two clicks in one tick can create two Razorpay orders.
  *Fix:* a synchronous `loadingRef` re-entrancy guard; apply the same guard to `addToCart`.

- [ ] **F-10 · Minus button at qty 1 is enabled but inert** — P2 ·
  `Frontend/src/pages/CartPage.jsx` (~line 86) vs the PDP equivalent which *is* disabled.
  *Fix:* disable it, or make it remove the item behind a confirmation.

- [ ] **F-11 · Guests are offered a coupon they cannot use** — P1 ·
  `Frontend/src/components/checkout/CouponInput.jsx` +
  `Backend/routes/couponRoutes.js` (`POST /validate` is `protect`-ed).
  *Fix:* hide the input for guests with a "Log in to apply a coupon" hint.

- [ ] **F-12 · Category + page are not in the URL** — P2 · `Frontend/src/pages/HomePage.jsx`.
  Refresh, Back, deep-link and share all lose the filter. Only `?search=` is URL-driven.
  *Fix:* drive `category` and `page` from `useSearchParams`.

- [ ] **F-13 · Double product fetch on filter change** — P2 · `Frontend/src/pages/HomePage.jsx`.
  Two effects share the same deps; when `page > 1` the reset effect sets `page = 1` but the fetch
  effect already ran with the old page (2 API calls + a flash of wrong-page results).
  *Fix:* fold both into one effect derived from URL state (resolves F-12 too).

- [ ] **F-14 · Session expiry loses the user's place** — P2 · `Frontend/src/api/axios.js`.
  The refresh-failure branch calls `navigateToLogin()` without setting `redirectAfterLogin`.
  *Fix:* store `pathname + search` in `sessionStorage` before redirecting.

- [ ] **F-15 · No shared route guard** — P2 · `/profile`, `/checkout` and `/admin` each
  reimplement redirect logic with inconsistent behaviour (only checkout preserves the return
  path). *Fix:* add `Frontend/src/components/ProtectedRoute.jsx` with an `adminOnly` prop; keep
  the checkout return-path semantics.

- [ ] **F-16 · No order-details view** — P2 · `Frontend/src/components/profile/OrdersTab.jsx`
  shows id, badges and totals but no items, address or status timeline.
  *Fix:* expandable row with `orderItems`, `shippingAddress`, coupon/discount breakdown and a
  status timeline, using `formatPrice`/`formatDate` from `utils/format`.

- [ ] **F-17 · No sort or price filter** — P2 · product discovery has only category chips and
  title search. *Fix:* server-side `sort` / `minPrice` / `maxPrice` in
  `Backend/routes/productRoutes.js` plus URL-driven controls on HomePage.
  **Do not** filter only the current page and imply catalogue-wide filtering.

- [ ] **F-18 · Admin catalogue capped at 100** — P1 · `Frontend/src/pages/AdminPage.jsx` calls
  `fetchProducts({ limit: 100 })` and filters client-side, so products beyond #100 are invisible
  and unmanageable. *Fix:* server-side search + pagination, or a documented, visible cap.

---

## Phase 3 — Responsive fixes

> **DoD:** every route screenshotted at 320 / 375 / 414 / 640 / 768 / 1024 / 1440 / 1920 px at
> 100% and 200% zoom with no horizontal scroll, overlap or clipped control.

- [ ] **F-19 · Pagination wraps into ragged rows** — P2 · `Frontend/src/pages/HomePage.jsx`
  (~lines 183–240). Nine controls × `min-w-[44px]` + gaps + `flex-wrap` ≈ 396px+ before gaps.
  *Fix:* `Prev` / `Next` + "Page X of Y" below `sm`; numeric pagination from `sm` up.

- [ ] **F-20 · Sub-44px touch targets** — P3 · `AdminOrdersTab.jsx` status `<select>` and filter
  chips (`min-h-[36px]`), `AdminCouponsTab.jsx` action buttons (`40px`), `HomePage.jsx` category
  chips (`min-h-[36px]`). *Fix:* raise all to 44px to match the app-wide standard.

- [ ] **F-21 · Conflicting image constraints** — P3 · `ProductCard.jsx` sets `h-56` **and**
  `aspectRatio: '1/1'` on the same node, so the frame is not deterministic across grid widths.
  *Fix:* keep `aspect-ratio` only.

- [ ] **F-22 · PDP image causes layout shift** — P3 · `ProductDetailsPage.jsx` has no
  width/height or `aspect-ratio` on the hero image. *Fix:* add one; guard `hover:scale-105` with
  `motion-safe:`.

- [ ] **F-23 · Nested scroll area** — P3 · `OrderSummary.jsx` wraps the item list in
  `max-h-60 overflow-y-auto` inside an already-scrolling page (touch scroll trap on mobile).
  *Fix:* drop the inner scroll on mobile.

- [ ] **F-24 · Navbar density at 640–767px** — P3 · `Frontend/src/components/Navbar.jsx`.
  Brand + "Hi, {name}" (capped at 80px) + cart + profile + admin shield + logout all share one
  16px-tall row. *Fix:* audit with an admin account and a long name; add `truncate` / `min-w-0`
  where needed.

- [ ] **F-25 · Cart-line layout at 320px** — P3 · `CartPage.jsx` line item (96px image + title +
  quantity group + delete button) in `flex-col sm:flex-row`. *Fix:* verify no squash or overflow
  at 320px; adjust the breakpoint or the image size if needed.

---

## Phase 4 — UI/UX consistency

> **DoD:** one placeholder image, one button/input/card visual language, and consistent
> success/error/loading/empty feedback on every interactive surface.

- [ ] **F-26 · Duplicated + corrupted placeholder image** — P2 · the same `PLACEHOLDER_IMG`
  constant is copy-pasted into 5 files, and **4 copies are corrupted base64**
  (`CartPage.jsx`, `ProductDetailsPage.jsx`, `ProductTable.jsx`, `ProductFormModal.jsx`); only
  `ProductCard.jsx` holds the valid payload.
  *Verified by decoding:* the corrupted string yields
  `<rect width://www.w3.org/2000/svg" width="200" .../>` — malformed SVG.
  *Fix:* export one constant from `Frontend/src/utils/imageUrl.js`, delete the 5 copies, use it
  as the `onError` fallback everywhere, **and add the missing `onError` to the PDP image**
  (currently a dead image URL shows the browser's broken-image glyph).

- [ ] **F-27 · Backend banner leaks dev info in production** — P2 ·
  `Frontend/src/components/BackendStatusBanner.jsx` renders `VITE_API_URL` and
  `cd Backend && npm run dev` to end users. *Fix:* user-facing copy only ("We can't reach Cartify
  right now"); log the URL in DEV only.

- [ ] **F-28 · Extract shared UI primitives** — P2 · the teal-600 / gray-900 CTA colours,
  `rounded-xl`, 44px targets, focus rings and input borders are repeated inline across ~30 files.
  *Fix:* add `Frontend/src/components/ui/` (`Button`, `Card`, `Input`, `Badge`) and migrate screen
  by screen with **no visual change**.

- [ ] **F-29 · `CouponInput` bypasses the currency formatter** — P3 · hardcoded
  `` `₹${Number(applied.discount).toFixed(2)}` `` instead of `formatPrice()` from `utils/format`.

- [ ] **F-30 · Success messages announced as alerts** — P3 · `Frontend/src/pages/LoginPage.jsx`
  renders `successMsg` with `role="alert"`; it should be `role="status"` (less interruptive).

- [ ] **F-31 · Emoji-only status in the admin tables** — P3 · `AdminCouponsTab.jsx` Active column
  renders `✅` / `⛔` with no text alternative. *Fix:* text + icon + `sr-only` label.

- [ ] **F-32 · Skeleton grid mismatch + 8 live regions** — P3 · `Skeleton.jsx` uses
  `xl:grid-cols-4` while `HomePage` uses `lg:grid-cols-4` (one-column shift at `lg`), and each
  `SkeletonCard` is its own `role="status"`. *Fix:* match the grid; wrap the list in a single
  status region.

- [ ] **F-33 · Two independent coupon instances** — P2 · `CartPage` and `CheckoutPage` each own a
  `useCoupon`, so the two screens can disagree about the applied discount.
  *Fix:* lift coupon state into one shared provider.

- [ ] **F-34 · Stale price snapshot on the cart** — P2 · `cartContext` stores `price` at add-time
  and only refreshes on server sync; guests can see indefinitely stale prices.
  *Fix:* refresh from the catalog (e.g. on cart mount) or badge the summary as "price confirmed
  at checkout". The backend remains the pricing authority — do not make the client authoritative.

- [ ] **F-35 · No warning when quantity exceeds stock** — P2 · if stock drops below the stored
  quantity, nothing surfaces until checkout. *Fix:* inline "Only N left" plus a clamp.

- [ ] **F-36 · Backend 10-address limit not surfaced** — P3 · `AddressManager.jsx`;
  `Backend/routes/addressRoutes.js` caps at 10 addresses but the UI only surfaces a raw 400.

---

## Phase 5 — Accessibility

> **DoD:** zero axe "serious"/"critical" violations on all 7 routes; full keyboard traversal of
> the primary journey; screen-reader tested on at least Home, PDP, Cart and Checkout.

- [ ] **F-37 · All modals are invisible to assistive tech** — P1 ·
  `Frontend/src/components/Modal.jsx` sets `aria-hidden="true"` on the wrapper that **contains**
  `role="dialog"`, so the dialog, its label and its buttons are removed from the accessibility
  tree while focus is trapped inside it. Affects every `ConfirmModal` (delete product / coupon /
  account / address, logout, refund) plus both form modals.
  *Fix:* render the backdrop as a **sibling** of the dialog instead of an `aria-hidden` ancestor;
  keep the existing focus trap, scroll lock and Escape handling; add `aria-describedby` on
  `ConfirmModal` pointing at the message.
  *Tests:* `Modal.test.jsx` — dialog is reachable by role; Tab cycles inside; Escape closes; focus
  returns to the trigger.

- [ ] **F-38 · Contrast failures** — P2 · `text-gray-400` (#9ca3af) on white = **2.5:1** against a
  4.5:1 AA requirement, used for review counts, "No reviews yet" and admin table testers;
  `text-orange-200` on the teal hero gradient and `text-teal-100` on teal-600 are borderline.
  *Fix:* move meaningful text to `text-gray-500`; keep `text-gray-400` only for decorative icons
  that already carry an accessible label.

- [ ] **F-39 · `aria-busy` missing on submitting forms** — P3 · LoginPage, CheckoutPage and the
  modals give no programmatic "submitting" signal.

- [ ] **F-40 · Cart total changes are not announced** — P3 · applying or removing a coupon changes
  the total silently. *Fix:* `aria-live="polite"` on the summary total.

- [ ] **F-41 · Auth field labelling and autofill** — P2 · `PasswordLoginForm.jsx` labels have no
  `htmlFor`; `PasswordInput` is given the stale `id="register-password"` even in login mode; and no
  field sets `autoComplete` (`email` / `current-password` / `new-password` / `one-time-code`), so
  password managers and mobile autofill degrade. *Fix:* pair every label with an id and add the
  correct `autoComplete` values.

- [ ] **F-42 · Automated a11y gate** — P2 · add `@axe-core/playwright` (or Lighthouse CI) to the
  pipeline and fail on serious/critical violations.

---

## Phase 6 — Performance

> **DoD:** before/after `dist/stats.html` comparison attached; no LCP/CLS regression on Home and
> PDP; the profiler shows the product grid no longer re-renders on cart mutation.

- [ ] **F-43 · `memo(ProductCard)` is defeated by the cart context** — P2 · `ProductCard` calls
  `useCart()`, and any cart change produces a new context value identity, so **all 12 cards
  re-render on every add / remove / quantity change**.
  *Fix:* split into `CartStateContext` (cart) and `CartActionsContext` (stable action callbacks),
  keeping `useCart()` as a facade over both for backwards compatibility.
  *Measure:* React DevTools Profiler render counts before/after; record in the PR.

- [ ] **F-44 · Sentry is bundled but never initialised** — P2 · `Frontend/src/main.jsx` imports
  `@sentry/react` and `@sentry/browser` and configures traces and replay sample rates, but
  `Sentry.init` is gated on `VITE_SENTRY_DSN` which is unset — so the bundle cost is paid for zero
  telemetry, and the replay sample rates have no replay integration.
  *Fix:* either set the DSN, add `replayIntegration` and add the Sentry ingest host to
  `connect-src` in `vercel.json`, **or** remove the dependency and the imports.

- [ ] **F-45 · Duplicate home fetch** — P3 · `HeroBanner.jsx` calls
  `fetchProducts({ limit: 1 })` while `HomePage.jsx` calls `fetchProducts({ page, limit: 12 })` —
  two requests per home load and per back-navigation.
  *Fix:* pass the count down, or drop it from the hero; keep the existing honest offline fallback
  ("top-quality products") that refuses to invent a number.

- [ ] **F-46 · No request caching or dedupe** — P3 · profile tabs and route revisits refetch
  everything. *Fix:* add a minimal cache/dedupe layer (or adopt TanStack Query) once F-43 and F-13
  have landed.

- [ ] **F-47 · `console.log` in production, including PII** — P3 ·
  `Frontend/src/hooks/useRazorpayPayment.js` logs `user.email`, cart length and Razorpay options on
  **every render**, plus six more lines per payment. *Fix:* gate behind `import.meta.env.DEV` or
  `logWarn`, matching `Frontend/src/utils/logger.js`.

- [ ] **F-48 · `filterProducts` throws on incomplete products** — P3 ·
  `Frontend/src/utils/products.js` calls `.toLowerCase()` on `p.title` / `p.category`; a product
  missing either field blanks the whole admin page. *Fix:* optional chaining plus `String()`
  coercion.

- [ ] **F-49 · Chunking and Suspense granularity** — P3 · `vite.config.ts` `manualChunks` has a
  catch-all `vendor` bucket, and the single app-level `<Suspense fallback={<Spinner/>}>` flashes a
  spinner on every lazy route. *Fix:* explicit chunks per future heavy library; consider per-route
  fallbacks.

---

## Phase 7 — Tooling, data authenticity & final QA

- [ ] **F-50 · `npm run typecheck` checks nothing** — P2 · `Frontend/tsconfig.json` has
  `"include": ["src"]` but no `allowJs`, so `tsc --noEmit` only sees the two `.ts` files, and
  `Frontend/src/types/index.ts` (147 lines, the full domain model) is imported by zero files —
  while CI reports "typecheck passed". *Fix:* per DEC-4 — enable `allowJs`/`checkJs` incrementally
  and actually import the types, or remove the CI step.

- [ ] **F-51 · E2E suite cannot run** — P2 · `Frontend/playwright.config.ts` sets
  `testDir: './qa'` but `Frontend/qa` does not exist (the `qa/` folder is at the repo root), and
  `@playwright/test` is not in `devDependencies`. *Fix:* repoint `testDir` and add the dependency,
  or delete the `test:e2e` script.

- [ ] **F-52 · Dead code** — P2 · `Frontend/src/types/index.ts` (entire file, unreferenced),
  `utils/format.js → calculateDiscount`, `utils/constants.js → getCategoryCount`,
  `version.js → BUILD_TIME`, and `hooks/useAddresses.js → updateAddress` (referenced only by its
  own export). *Fix:* adopt or delete each.

- [ ] **F-53 · Fabricated ratings and reviews shown as real social proof** — P2 ·
  (a) `Frontend/src/data/seedProducts.js` invents ratings and counts (e.g. `Sony WH-1000XM5 →
  4.6/2341`, `PS5 Slim → 4.9/4502`, `Nivea SPF50 → 4.2/5678`) and is injectable from the
  production admin UI; (b) there is **no review system**, yet PDP and ProductCard render
  "Based on N reviews"; (c) `ProductFormModal.jsx` exposes free-text "Rating (0–5)" and
  "Review Count" inputs.
  *Fix:* label the seed set as demo data or remove the seed action from the production admin UI;
  replace review copy with a neutral "Not yet rated" until a real review source exists; make the
  rating fields read-only or clearly admin-only metadata.
  **Never invent** customer counts, sales, testimonials or delivery statistics.

- [ ] **F-54 · Version badge is wrong** — P3 · `Footer.jsx` shows `v1.0.0` from a hardcoded
  `PACKAGE_VERSION` while `package.json` says `0.0.0`; `BUILD_TIME` is exported and unused.

- [ ] **F-55 · Unverifiable claims in the UI** — P3 · `SHIPPING_CONFIG.ESTIMATED_DELIVERY_DAYS =
  '3-5'` (rendered as "Estimated delivery: 3-5 business days"), `SUPPORT_EMAIL =
  support@cartify.com`, an Unsplash stock photo as `og:image`, and `og:url` pointing at
  `cartify-hub.vercel.app`. *Fix:* confirm each reflects reality, or mark/remove it.

- [ ] **F-56 · Test coverage for the audited paths** — P1 · only 6 spec files exist against 65
  source files, all utility-level. Required new suites: `cartContext` (F-03/F-04),
  `useAddresses` (F-01), `useCoupon` (F-04/F-33), `useRazorpayPayment` (F-02/F-09), `Modal`
  (F-37), `ProductCard` (F-06), `AdminOrdersTab` (F-07), `HomePage` URL state (F-12/F-13).

- [ ] **F-57 · Commit/review the uncommitted address work separately** — housekeeping · it
  currently contains F-01 and is mixed with unrelated `Backend/package.json` edits and 4 untracked
  backend image scripts. *Fix:* land it as its own reviewable commit (mostly `Frontend/src`).

- [~] **F-58 · Update project docs** — housekeeping · done: `Docs/BUGS.md` now lists the confirmed
  P0/P1 defects (it previously claimed "No confirmed bugs yet") and `Docs/ROADMAP.md` gained
  Phase 5. Remaining: record the shipping decision as an ADR under `Docs/ADR/`, following
  `Docs/ADR/0003-server-authoritative-payments.md` (blocked on DEC-1), and tick tasks off here as
  they land.

---

## Suggested execution order

| Order | Tasks | Why this order |
|---|---|---|
| 1 | DEC-1…DEC-4, F-05 | Unblocks everything; F-05 turns CI green so every later change is gated |
| 2 | F-01, F-02 (per DEC-1), F-03, F-04 | P0 data, privacy and money correctness |
| 3 | F-56 (tests for step 2) | Lock in the P0 fixes before touching UI |
| 4 | F-06, F-07, F-08, F-09, F-10, F-11 | Visible flow-breaking bugs |
| 5 | F-12, F-13, F-14, F-15, F-16 | Deep-link / refresh / auth-flow correctness |
| 6 | F-19 … F-25 | Responsive pass at all breakpoints |
| 7 | F-26, F-37, F-41, F-38 | Highest-value consistency + accessibility fixes |
| 8 | F-28, F-27, F-29 … F-36 | Design-system extraction and polish |
| 9 | F-43, F-44, F-45, F-47 | Performance, with measurement |
| 10 | F-17, F-18, F-50, F-51, F-52, F-53, F-42 | Feature gaps, tooling, data authenticity |
| 11 | F-54, F-55, F-57, F-58 | Housekeeping and docs |

## Global guardrails for every task

- Never introduce a client-side price, discount or shipping value that the backend does not also
  compute (see `Docs/ADR/0003-server-authoritative-payments.md`).
- Never invent statistics, reviews, ratings, stock or testimonials.
- Keep `Frontend/src/utils/logger.js` as the only logging path outside `ErrorBoundary` and the
  global `window` handlers in `main.jsx`.
- No visual redesign — only hierarchy, spacing, states and consistency.
- Every P0/P1 task ships with a test. Run `npm run lint && npm run test` before marking a task done.
- Preserve: server-authoritative payments, the CSRF/401 interceptor with single-flight refresh,
  the focus-trapped Modal, the skip link + `:focus-visible` ring + reduced-motion block, the
  dependency-free SVG illustrations, and the honest offline hero copy.

## Verified as already correct (do not "fix")

- `Frontend/.env` is **not** tracked by git (`git ls-files` shows only `.env.example`) and is
  gitignored — no leaked keys.
- The client never sends prices, totals or payment status; it sends only `productId` + `quantity`
  + address + coupon code, and the backend recomputes everything.
- The axios interceptor suppresses 401s for guests via a `localStorage` session hint, so guest
  browsing produces no console noise.
- Google Identity Services uses redirect mode with a serverless landing page and server-side JWT
  verification, guarded against StrictMode double-init.
- `HeroBanner` refuses to fabricate a product count when the API is unreachable.
- No fake customer counts, testimonials, revenue or discounts were found anywhere in the UI.