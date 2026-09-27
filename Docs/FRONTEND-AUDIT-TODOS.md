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

- [x] **DEC-1A (recommended)** ✅ decided 2026-09-26 — Remove the fee from the display. Keep "free shipping over ₹999"
      as marketing copy only. Render the CTA amount from the server response.
- [x] **DEC-1B** Implement shipping server-side (`paymentRoutes.js` + `Order` model + refund
      math + order-history display) so the charge matches the display.
      — **declined 2026-09-26** in favour of DEC-1A; path recorded in `Docs/ADR/0005-honest-shipping-display.md`.

### DEC-2 · Logout cart policy (blocks F-03)

`CartProvider` keeps `cart` and `localStorage['cart']` after logout, so the next user's login
**merges the previous user's items** into their server cart.

- [x] **DEC-2A (recommended)** ✅ decided 2026-09-26 — Discard the local cart on logout.
      (Implemented with a `prevUserIdRef` so a pure guest session keeps its cart.)
- [x] **DEC-2B** Keep it for the same user; discard only when a *different* user id logs in.
      — **declined 2026-09-26**; DEC-2A (discard on logout, guest sessions keep cart) chosen.

### DEC-3 · Uncommitted address work (blocks F-01)

✅ **Resolved 2026-09-26** — the address work landed in `ccfdb05`; `useAddresses.js` in the tree
already carries the F-01 fix (`setAddresses(response.data)`).

### DEC-4 · TypeScript strategy (blocks F-50)

✅ **Decided 2026-09-26: adopt incrementally.** `allowJs: true` is now on in `tsconfig.json`
(`checkJs` stays off until types are adopted file-by-file). Immediate payoff: `tsc` caught a
duplicate `className` JSX attribute in `AdminNotificationsTab.jsx` that React was silently
resolving last-wins.

---

## Phase 1 — Critical bugs (P0)

> **Definition of Done:** `npm run lint` and `npm run test` pass; manual walk-through of
> guest → login → logout → second login proves no cross-user data leak; no screen shows an
> amount that differs from what Razorpay charges.

- [x] **F-01 · Deleted address reappears** — P0 · data integrity ✅ 2026-09-26
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
    ✅ shipped: both + "does not apply an in-flight response from a previous owner"
    (`requestSeqRef` guards every write; the owner-change effect invalidates in-flight requests).

- [x] **F-02 · Displayed total ≠ charged total** — P0 · money ✅ 2026-09-26 (DEC-1A)
  - **Files:** `Frontend/src/utils/constants.js`, `Frontend/src/pages/CartPage.jsx`,
    `Frontend/src/components/checkout/OrderSummary.jsx` (`getShippingCost`)
  - **Problem:** see DEC-1.
  - **Fix (DEC-1A):** remove `getShippingCost` from the money path in `CartPage` and
    `OrderSummary`; `finalTotal = discountedSubtotal`; turn the "Shipping" row into a
    non-monetary "Free delivery on orders over ₹999" note; keep the button label in sync with the
    amount the backend will charge.
  - **Acceptance:** for a ₹500 cart the summary, the CTA label and the Razorpay modal all agree;
    no currency value is computed only on the client.
  - **Tests:** `OrderSummary.test.jsx` — "total equals subtotal when shipping is not charged";
    `useRazorpayPayment.test.js` — "CTA amount matches `order.calculatedAmount`".
    ✅ shipped: 4 + 4 tests respectively (Pay label, discount path, server-amount modal,
    price-drift warning, free-order shortcut). FaqPage's false "standard shipping is ₹79" copy
    corrected too; `getShippingCost` remains only as an unused informational helper (F-52).

- [x] **F-03 · Cross-user cart leak on login** — P0 · privacy ✅ 2026-09-26 (DEC-2A)
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
    ✅ shipped: 5 tests incl. "keeps a pure guest cart" (logout detection via `prevUserIdRef`,
    so null→null guest sessions are never wiped). Mutation-verified (disabling the clear branch
    fails exactly the 3 logout/merge/coupon tests).

- [x] **F-04 · Coupon leaks to the next user** — P0 · money (ships with F-03) ✅ 2026-09-26
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
    ✅ shipped via `clearStoredCoupon()` exported from `useCoupon.js` and called in CartProvider's
    logout branch — works even when no screen with a mounted `useCoupon` instance is open;
    covered by `cartContext.test.jsx` "clears the persisted coupon code on logout" + the
    cross-user merge test. Mounted instances empty-cart-clear their own state (existing guard).

- [x] **F-05 · CI lint is red — deploy is blocked** — P0 · pipeline ✅ 2026-09-26
  - **Files:** `Frontend/src/hooks/useAddresses.js:73`,
    `Frontend/src/pages/ProductDetailsPage.jsx:18`
  - **Problem:** `npm run lint` fails with 6 `no-unused-vars` errors, so
    `Frontend/.github/workflows/ci.yml` never reaches its `build` / `deploy` jobs.
  - **Fix:** remove the unused `PLACEHOLDER_IMG` from `ProductDetailsPage.jsx` (F-26 replaces it
    with a shared constant) and drop the unused destructured aliases in `useAddresses.js` — or set
    `ignoreRestSiblings` in `eslint.config.js` if the omit-idiom is intentional.
  - **Acceptance:** `cd Frontend && npm run lint` exits 0.
  - **Verify:** the job must be green *before* any other task is marked done.
  - ✅ **Done:** `eslint .` exits 0 (410 errors → **0 errors / 4 pre-existing warnings**).
    Scope was much larger than the audit baseline — errors came from the later admin-portal
    commit plus `.tmp_smoke_profile/` (332 junk errors, now ignored) and 3 one-off debug probes
    (deleted). Fixes: unused imports/vars removed across ~25 files; `no-unused-vars` gained the
    doc-sanctioned `ignoreRestSiblings` + `^_` patterns; deliberate loading/URL-sync effects
    carry `react-hooks/set-state-in-effect` disables with reasons (repo convention from
    HomePage); `defaultIcon`/`divIcon` moved to `map/mapIcons.js` (react-refresh);
    `MapContainer`'s never-set `mapError` dead branch removed; SearchBox recents moved to lazy
    `useState` init; useGPS useless assignment fixed.

**Phase 1 verification**
```bash
cd Frontend && npm run lint && npm run test
```

---

## Phase 2 — User-flow correctness

> **DoD:** every step of Home → discovery → search → category → product → cart → login →
> address → checkout → pay → confirmation → order history → order details survives Back,
> refresh, direct URL, double-click, API failure and expired session.

- [x] **F-06 · Add-to-cart gives no feedback** — P1 · ✅ 2026-09-26
  `Frontend/src/components/ProductCard.jsx` → `handleAddToCart` only calls `addToCart`.
  Add a success toast plus a short button state (reuse the PDP pattern and the existing
  `react-hot-toast`) and an accessible `aria-live` confirmation.
  *Tests:* new `ProductCard.test.jsx` (zero coverage today).
  ✅ Shipped: `toast.success('Added to cart')` + 1.5s "Added ✓" button state
  (timer ref, cleanup on unmount) + `sr-only` `role="status"` live region;
  variant routing and out-of-stock paths give no feedback. New
  `ProductCard.test.jsx` — 4 tests.

- [x] **F-07 · Admin status transitions disagree with the API** — P1 · ✅ 2026-09-26
  `Frontend/src/components/admin/AdminOrdersTab.jsx` `LEGAL_TRANSITIONS` vs
  `Backend/routes/orderRoutes.js` `ALLOWED_TRANSITIONS`. The UI offers `Pending → Shipped`
  (server returns 400) and hides the valid `Shipped → Cancelled`.
  *Fix:* mirror the backend map exactly and add a comment naming the backend file as the source
  of truth. *Tests:* assert the `<option>` set rendered for each status.
  ✅ Shipped: map extracted to `src/utils/orderTransitions.js` (`ORDER_TRANSITIONS` +
  `nextStatuses`) citing `orderRoutes.js` as source of truth; `AdminOrdersTab` imports it
  (`Pending → [Processing, Cancelled]`, `Shipped → [Delivered, Cancelled]` now match).
  The select derives its options from `nextStatuses`, so `orderTransitions.test.js`
  (3 tests) locks UI == backend map.

- [x] **F-08 · Post-payment empty checkout** — P2 · ✅ 2026-09-26 (verify-only)
  `Frontend/src/pages/CheckoutPage.jsx`.
  The `orderJustPlaced` early-return renders a checkout with a ₹0 subtotal and a **₹79** total.
  *Fix:* on payment success navigate to `/profile?tab=orders`; always bounce an empty cart to
  `/cart`; remove the `orderJustPlaced` flag and its `sessionStorage` choreography.
  ✅ Already resolved by earlier work: repo-wide `grep orderJustPlaced` = 0 matches,
  `useRazorpayPayment` success navigates `/profile?tab=orders` (incl. free-order shortcut),
  and `CheckoutPage` bounces an empty cart to `/cart` (replace). Covered by
  `useRazorpayPayment.test.js` (success + free-order navigation asserts).

- [x] **F-09 · Pay button can double-fire** — P2 · ✅ 2026-09-26
  `Frontend/src/hooks/useRazorpayPayment.js`.
  `setLoading(true)` is async, so two clicks in one tick can create two Razorpay orders.
  *Fix:* a synchronous `loadingRef` re-entrancy guard; apply the same guard to `addToCart`.
  ✅ Shipped: `loadingRef` set synchronously before the first `await`, top-of-function
  re-entry guard, cleared in lockstep with `setLoading(false)` (SDK-fail path + `finally`).
  **Deliberate deviation:** `addToCart` left unguarded — a double-click there means
  "qty + 2", which is the correct cart semantic (no server side-effect to protect).
  Test: `useRazorpayPayment.test.js` "rapid double-click creates exactly one order".

- [x] **F-10 · Minus button at qty 1 is enabled but inert** — P2 · ✅ 2026-09-26
  `Frontend/src/pages/CartPage.jsx` (~line 86) vs the PDP equivalent which *is* disabled.
  *Fix:* disable it, or make it remove the item behind a confirmation.
  ✅ Shipped: minus disabled at qty 1 with the PDP's `disabled:opacity-40
  disabled:cursor-not-allowed` classes + "Minimum quantity is 1 — use Remove instead"
  title. Tests in `CartPage.test.jsx` (3).

- [x] **F-11 · Guests are offered a coupon they cannot use** — P1 · ✅ 2026-09-26
  `Frontend/src/components/checkout/CouponInput.jsx` +
  `Backend/routes/couponRoutes.js` (`POST /validate` is `protect`-ed).
  *Fix:* hide the input for guests with a "Log in to apply a coupon" hint.
  ✅ Shipped at the guest-visible surface: `CartPage` renders the input only when
  signed in; guests get a "Log in to apply a coupon" hint whose link stores
  `redirectAfterLogin=/cart`. (Checkout's `OrderSummary` is behind the F-15 guard,
  login-only.) Tests in `CartPage.test.jsx` (3).

- [x] **F-12 · Category + page are not in the URL** — P2 · ✅ 2026-09-26
  `Frontend/src/pages/HomePage.jsx`.
  Refresh, Back, deep-link and share all lose the filter. Only `?search=` is URL-driven.
  *Fix:* drive `category` and `page` from `useSearchParams`.
  ✅ Shipped: `page`/`category` local state removed — `?search= ?category= ?page=`
  all derived from `useSearchParams`; `goToPage` rewrites `?page=` (drops it for page 1)
  while preserving filters. Tests: deep-link fetch, URL after paging.

- [x] **F-13 · Double product fetch on filter change** — P2 · ✅ 2026-09-26
  `Frontend/src/pages/HomePage.jsx`.
  Two effects share the same deps; when `page > 1` the reset effect sets `page = 1` but the fetch
  effect already ran with the old page (2 API calls + a flash of wrong-page results).
  *Fix:* fold both into one effect derived from URL state (resolves F-12 too).
  ✅ Shipped with F-12: the category-sync + loading-reset effects are gone; a
  single fetch effect (deps: page, category, search, sort, min, max, retryKey)
  owns loading/error/fetch. Test asserts exactly one fetch per URL change.

- [x] **F-14 · Session expiry loses the user's place** — P2 · ✅ 2026-09-26
  `Frontend/src/api/axios.js`.
  The refresh-failure branch calls `navigateToLogin()` without setting `redirectAfterLogin`.
  *Fix:* store `pathname + search` in `sessionStorage` before redirecting.
  ✅ Shipped: new `saveLoginRedirect()` in `utils/navigation.js` (skips `/login` paths)
  called from axios's refresh-catch and from RoleGuard (F-15). Tests:
  `axios.test.js` (session-hint redirect + guest no-redirect) and
  `navigation.test.js` (4).

- [x] **F-15 · No shared route guard** — P2 · ✅ 2026-09-26
  `/profile`, `/checkout` and `/admin` each
  reimplement redirect logic with inconsistent behaviour (only checkout preserves the return
  path). *Fix:* add `Frontend/src/components/ProtectedRoute.jsx` with an `adminOnly` prop; keep
  the checkout return-path semantics.
  ✅ Shipped by extending the existing `RoleGuard` instead of a new file (same contract,
  no duplicate mechanism): `allowedRoles` optional → omitted = any signed-in user;
  guest redirect now records `redirectAfterLogin` (was `state.from`, which LoginPage
  never read — that bug is why only checkout preserved the path). `/profile` and
  `/checkout` wrapped in App.jsx; CheckoutPage's inline `!user` redirect removed
  (empty-cart bounce kept). Tests: `RoleGuard.test.jsx` (5).

- [x] **F-16 · No order-details view** — P2 · ✅ 2026-09-26
  `Frontend/src/components/profile/OrdersTab.jsx`
  shows id, badges and totals but no items, address or status timeline.
  *Fix:* expandable row with `orderItems`, `shippingAddress`, coupon/discount breakdown and a
  status timeline, using `formatPrice`/`formatDate` from `utils/format`.
  ✅ Partial → complete: items/address/discount already existed; added the missing
  **status timeline** (`Pending → Processing → Shipped → Delivered` with done/current/future
  steps, `aria-current="step"`, Cancelled shows a notice instead) and made item titles
  link to `/product/:productId` when an id exists. Tests: `OrdersTab.test.jsx` (4).

- [x] **F-17 · No sort or price filter** — P2 · ✅ 2026-09-26 (DEC-5: backend in scope)
  product discovery has only category chips and
  title search. *Fix:* server-side `sort` / `minPrice` / `maxPrice` in
  `Backend/routes/productRoutes.js` plus URL-driven controls on HomePage.
  **Do not** filter only the current page and imply catalogue-wide filtering.
  ✅ Shipped: backend `GET /products` gained a whitelisted `sort`
  (`newest|price_asc|price_desc|rating`, default newest, `hasOwnProperty` guard against
  `?sort=constructor`) and `parsePrice`-clamped `minPrice`/`maxPrice` (junk ignored) —
  all catalogue-wide via query, backed by existing `price`/`createdAt` indexes.
  HomePage: sort `<select>` + Min/Max inputs + Apply, everything URL-driven
  (`?sort= ?min= ?max=`), page resets to 1 on change; price inputs commit only on Apply.
  Tests: `productRoutes.test.js` +6 (23 total) and `HomePage.test.jsx` +3.

- [x] **F-18 · Admin catalogue capped at 100** — P1 · ✅ 2026-09-26 (DEC-6: cap note)
  `Frontend/src/pages/AdminPage.jsx` calls
  `fetchProducts({ limit: 100 })` and filters client-side, so products beyond #100 are invisible
  and unmanageable. *Fix:* server-side search + pagination, or a documented, visible cap.
  ✅ Shipped as the documented visible cap: `useAdminProducts` already fetches
  `{ limit: 100 }` (verified + locked by new `useAdminProducts.test.js`); AdminPage now
  shows an amber `role="status"` note when the cap is hit ("Showing the first 100
  products — use the search box or category filter…"). Full server-side pagination
  deferred to a later phase.

---

## Phase 3 — Responsive fixes

> **DoD:** every route screenshotted at 320 / 375 / 414 / 640 / 768 / 1024 / 1440 / 1920 px at
> 100% and 200% zoom with no horizontal scroll, overlap or clipped control.

- [x] **F-19 · Pagination wraps into ragged rows** — P2 · `Frontend/src/pages/HomePage.jsx` (~lines 183–240).
  *Done:* below `sm` renders only Prev / "Page X of Y" / Next; First/Last hidden (`hidden sm:inline-flex`);
  numeric row wrapped in `hidden sm:flex`. Gate: lint/typecheck/142 tests/build ✅.

- [x] **F-20 · Sub-44px touch targets** — P3.
  *Done:* repo-wide sweep `min-h/min-w-[36px]` → `[44px]` and `[40px]` → `[44px]` (44 replacements
  across admin tabs, WarehousePortal, AvailableCouponsModal, ProductFormModal, etc.). Note: `HomePage`
  category chips no longer exist (F-12/13 URL-state refactor); `ShopByCategory` cards are `min-h-[120px]`.

- [x] **F-21 · Conflicting image constraints** — P3 · *doc location stale:* the conflict is in
  `Skeleton.jsx:5` (`h-56` + `aspectRatio: '1/1'`); `ProductCard` has no aspect-ratio (uses `h-44 sm:h-56`).
  *Done:* skeleton image block now `h-44 sm:h-56`, mirrors ProductCard, no aspect-ratio.

- [x] **F-22 · PDP image causes layout shift** — P3 · `ProductDetailsPage.jsx`.
  *Done:* hero wrapper is now `aspect-square` (deterministic frame, `min-h-[300px]`/`max-h-*` removed),
  img `h-full w-full object-contain`; `hover:scale-105` → `motion-safe:hover:scale-105` on PDP **and**
  ProductCard (`motion-safe:group-hover:scale-105`).

- [x] **F-23 · Nested scroll area** — P3 · `OrderSummary.jsx`.
  *Done:* inner list scroll is `sm:max-h-60 sm:overflow-y-auto` only — no scroll trap on mobile.

- [x] **F-24 · Navbar density at 640–767px** — P3 · `Navbar.jsx`.
  *Done:* audited worst case (delivery user @640px ≈ 490px of row content → fits); name already capped
  `max-w-[80px] truncate`; added `min-w-0` to the account-menu button so the truncate can engage under
  pressure. Admin sees no wishlist link, further reducing density.

- [x] **F-25 · Cart-line layout at 320px** — P3 · `CartPage.jsx`.
  *Done:* quantity group + Remove button wrapped in one `flex items-center gap-4` row (no orphaned
  delete row on mobile); column layout at 320px verified — all children ≤ 160px wide, no overflow.

---

## Phase 4 — UI/UX consistency

> **DoD:** one placeholder image, one button/input/card visual language, and consistent
> success/error/loading/empty feedback on every interactive surface.

- [x] **F-26 · Duplicated + corrupted placeholder image** — P2.
  *Done:* `PLACEHOLDER_IMG` exported from `utils/imageUrl.js`; all 5 local copies deleted
  (ProductCard, CartPage, ProductDetailsPage, ProductTable, ProductFormModal — the 4 corrupted
  payloads are gone). `onError` fallbacks use the shared import; PDP `onError` verified present
  (doc's "missing onError" was stale). Gate ✅.

- [x] **F-27 · Backend banner leaks dev info in production** — P2 ·
  `Frontend/src/components/BackendStatusBanner.jsx` renders `VITE_API_URL` and
  `cd Backend && npm run dev` to end users. *Fix:* user-facing copy only ("We can't reach Cartify
  right now"); log the URL in DEV only.
  *Done:* banner takes `prodBuild` prop (defaults `import.meta.env.PROD`) — prod shows
  "We can't reach Cartify right now." + user-facing advice; dev keeps
  "We can't reach the API at {apiTarget}." + `npm run dev` hint. Test asserts prod output hides
  the URL/dev instructions (10/10 in `BackendStatusBanner.test.jsx`). Gate ✅.

- [x] **F-28 · Extract shared UI primitives** — P2 · the teal-600 / gray-900 CTA colours,
  `rounded-xl`, 44px targets, focus rings and input borders are repeated inline across ~30 files.
  *Fix:* add `Frontend/src/components/ui/` (`Button`, `Card`, `Input`, `Badge`) and migrate screen
  by screen with **no visual change**.
  *Done:* `ui/Button` (variants `teal`/`dark`/`none`), `ui/Card`, `ui/Input`, `ui/Badge`
  (tint variants `success`/`successSoft`/`danger`/`dangerSoft`/`info`/`neutral`/`none`) +
  `ui.test.jsx` (9/9). Migrated **131 static string-className call sites** — Button 48 (33 files),
  Input 33 (9), Card 43 (21), Badge 7 (6) — via class-parity: only tokens the primitive re-adds
  verbatim are stripped from the caller, so class sets are equal → pixel parity. Dark CTAs get
  `variant="dark"` (Password/Forgot/OTP forms + OrderSummary pay button). Documented boundaries
  (unchanged by design): Link/`<a>` CTAs, Footer, state-toggle template buttons (ProductCard,
  PDP add-to-cart), dynamic style-map badges, 46 inputs using a different focus style (no teal
  focus ring to strip), 7 identifier/JSX-wrapped `className={…}` inputs, amber status badge
  (no amber variant in the locked set). Gate ✅ lint 0 err / tsc 0 / 160 tests / build ✓.

- [x] **F-29 · `CouponInput` bypasses the currency formatter** — P3 · hardcoded
  `` `₹${Number(applied.discount).toFixed(2)}` `` instead of `formatPrice()` from `utils/format`.
  *Done:* all 5 raw-`₹` sites now `formatPrice(v, { showDecimals: false })` — CouponInput,
  OrderSummary, AvailableCouponsModal, HomeSections campaign banner, AdminCampaignsTab.
  Sweep found no other `₹${…}` interpolations.

- [x] **F-30 · Success messages announced as alerts** — P3 · `Frontend/src/pages/LoginPage.jsx`
  renders `successMsg` with `role="alert"`; it should be `role="status"` (less interruptive).
  *Done:* `LoginPage.jsx:254` → `role="status"`; error banner stays `role="alert"`.

- [x] **F-31 · Emoji-only status in the admin tables** — P3 · `AdminCouponsTab.jsx` Active column
  renders `✅` / `⛔` with no text alternative. *Fix:* text + icon + `sr-only` label.
  *Done:* replaced with `CheckCircle2`/`XCircle` (aria-hidden) + visible "Active"/"Inactive"
  text — label is read directly, no sr-only duplicate needed. Emoji no longer the only signal.

- [x] **F-32 · Skeleton grid mismatch + 8 live regions** — P3 · `Skeleton.jsx` uses
  `xl:grid-cols-4` while `HomePage` uses `lg:grid-cols-4` (one-column shift at `lg`), and each
  `SkeletonCard` is its own `role="status"`. *Fix:* match the grid; wrap the list in a single
  status region.
  *Done:* `SkeletonList` grid → `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (matches
  HomePage) with one `role="status" aria-label="Loading products"` wrapper; `SkeletonCard`
  cards are now `aria-hidden` (no per-card live region). Other skeleton grids given single
  status wrappers too: WishlistPage, PDP related, HomeSections `SkeletonListStub`.

- [x] **F-33 · Two independent coupon instances** — P2 · `CartPage` and `CheckoutPage` each own a
  `useCoupon`, so the two screens can disagree about the applied discount.
  *Fix:* lift coupon state into one shared provider.
  *Done:* new `context/couponContext.jsx` — `CouponProvider` (inside `CartProvider` in
  `main.jsx`) reads the cart once, computes `totalAmount` with the same Σ price×qty formula,
  runs one `useCoupon` instance; `useSharedCoupon()` consumed by CartPage + CheckoutPage.
  Legacy `useCoupon(cart, total)` implementation untouched → its 10 unit tests still pass.
  `CartPage.test.jsx` mock switched to `useSharedCoupon`. Cart/Checkout can no longer
  disagree — they are literally the same state.

- [x] **F-34 · Stale price snapshot on the cart** — P2 · `cartContext` stores `price` at add-time
  and only refreshes on server sync; guests can see indefinitely stale prices.
  *Fix:* refresh from the catalog (e.g. on cart mount) or badge the summary as "price confirmed
  at checkout". The backend remains the pricing authority — do not make the client authoritative.
  *Done:* honest badge chosen (owner-approved plan): "Final price confirmed at checkout." under
  the Total row in `CartPage` summary and `OrderSummary`. No bulk price fetch — no ids endpoint
  exists (noted); backend stays pricing authority.

- [x] **F-35 · No warning when quantity exceeds stock** — P2 · if stock drops below the stored
  quantity, nothing surfaces until checkout. *Fix:* inline "Only N left" plus a clamp.
  *Done:* CartPage row gained a visible inline note "Only {N} left in stock" (orange) whenever
  `quantity >= countInStock`; the `+` button was already clamped/disabled at stock with a
  title tooltip (F-10 era) — the note makes it visible without hovering.

- [x] **F-36 · Backend 10-address limit not surfaced** — P3 · `AddressManager.jsx`;
  `Backend/routes/addressRoutes.js` caps at 10 addresses but the UI only surfaces a raw 400.
  *Done:* "Add New" button replaced by "Address limit reached (10)" chip at 10 addresses
  (prevents the 400 entirely); save `catch` now `toast.error(handleApiError(err, 'Failed to
  save address'))` so any future server message (duplicate, validation) surfaces verbatim.

---

## Phase 5 — Accessibility

> **DoD:** zero axe "serious"/"critical" violations on all 7 routes; full keyboard traversal of
> the primary journey; screen-reader tested on at least Home, PDP, Cart and Checkout.

- [x] **F-37 · All modals are invisible to assistive tech** — P1 ·
  *Done:* removed `aria-hidden="true"` from the Modal wrapper (backdrop keeps
  `role="presentation"`, which does not hide descendants); added `describedBy` prop →
  `aria-describedby`; `ConfirmModal` message wired via `useId`. Focus trap/scroll lock/Escape
  untouched. *Tests:* `Modal.test.jsx` 8 tests — reachable by role, focus enters, Tab/shift-Tab
  cycle, Escape (and blockClose), focus restore, scroll lock, ConfirmModal describedby. ✅

- [x] **F-38 · Contrast failures** — P2.
  *Done:* repo-wide `text-gray-400` → `text-gray-500` (136 replacements, 46 files); **excluded
  `Footer.jsx`** (gray-400 on gray-900 = 5.7:1, passes AA — darkening would break it).
  HeroBanner: `text-teal-100` paragraph → `text-white`; `text-orange-200` (badge + accent word)
  → `text-orange-100`. Navbar `text-teal-100` hits are `aria-hidden` decorative (phone number).
  Gate ✅.

- [x] **F-39 · `aria-busy` missing on submitting forms** — P3 · LoginPage, CheckoutPage and the
  modals give no programmatic "submitting" signal.
  **Done (Wave E):** `aria-busy` bound to each form's submitting state — `PasswordLoginForm`,
  `OTPLoginForm` (send + verify), `ForgotPasswordForm` (both steps), `CouponInput`, `ProductFormModal`
  (`saving`), `CouponFormModal` (`saving`); `ConfirmModal` confirm button and the checkout `Pay`
  button carry `aria-busy={loading}` too. Gate ✅.

- [x] **F-40 · Cart total changes are not announced** — P3 · applying or removing a coupon changes
  the total silently. *Fix:* `aria-live="polite"` on the summary total.
  **Done (Wave E):** `aria-live="polite" aria-atomic="true"` on the totals in `OrderSummary`
  (checkout) and `CartPage` (desktop summary + mobile sticky bar). Gate ✅.

- [x] **F-41 · Auth field labelling and autofill** — P2.
  *Done:* `PasswordLoginForm` — `htmlFor`/`id` pairs (`auth-name`, `auth-email`), dynamic password
  id (`auth-password-register` / `auth-password-login`, stale `register-password` gone),
  `autoComplete`: `name` / `email` / `new-password` | `current-password`. `OTPLoginForm` email
  paired + `autoComplete="email"`; both OTP digit rows now `autoComplete="one-time-code"`.
  `ForgotPasswordForm` email + new-password paired with `autoComplete` (`email`/`new-password`).
  Gate ✅.

- [x] **F-42 · Automated a11y gate** — P2 · add `@axe-core/playwright` (or Lighthouse CI) to the
  pipeline and fail on serious/critical violations.
  **Done (Wave E):** `axe-core` devDep + `src/test/axeHelper.js` (jsdom-safe: `color-contrast`
  disabled — no rendered colours in jsdom; contrast audited manually in F-23/F-24) + gate test
  `src/test/axe.test.jsx` running axe over the UI primitives form, the `Modal` dialog and
  `ProductCard`, failing on any serious/critical violation. Runs in the existing `npm test` CI job
  (3/3 passing). Playwright route deliberately not used — see F-51.

---

## Phase 6 — Performance

> **DoD:** before/after `dist/stats.html` comparison attached; no LCP/CLS regression on Home and
> PDP; the profiler shows the product grid no longer re-renders on cart mutation.

- [x] **F-43 · `memo(ProductCard)` is defeated by the cart context** — P2 · `ProductCard` calls
  `useCart()`, and any cart change produces a new context value identity, so **all 12 cards
  re-render on every add / remove / quantity change**.
  *Fix:* split into `CartStateContext` (cart) and `CartActionsContext` (stable action callbacks),
  keeping `useCart()` as a facade over both for backwards compatibility.
  *Measure:* React DevTools Profiler render counts before/after; record in the PR.
  **Done (Wave D):** `context/cartContext.jsx` now exports `CartStateContext` +
  `CartActionsContext`, `useCartState` / `useCartActions`, and the unchanged `useCart()` facade.
  `ProductCard.jsx` switched to `useCartActions()` so `memo` survives cart changes. Covered by
  `src/context/cartContext.test.jsx` (2 tests): an actions-only probe does **not** re-render across
  add/inc/remove/clear while a state probe + facade do. Owner to confirm with DevTools Profiler on
  localhost (F-57).

- [x] **F-44 · Sentry is bundled but never initialised** — P2 · `Frontend/src/main.jsx` imports
  `@sentry/react` and `@sentry/browser` and configures traces and replay sample rates, but
  `Sentry.init` is gated on `VITE_SENTRY_DSN` which is unset — so the bundle cost is paid for zero
  telemetry, and the replay sample rates have no replay integration.
  *Fix:* either set the DSN, add `replayIntegration` and add the Sentry ingest host to
  `connect-src` in `vercel.json`, **or** remove the dependency and the imports.
  **Done (Wave D):** remove-complete per locked F-44 — `Sentry.init` block + both imports deleted
  from `main.jsx`, `npm uninstall @sentry/react @sentry/browser`; no other Sentry references in the
  repo.

- [x] **F-45 · Duplicate home fetch** — P3 · `HeroBanner.jsx` calls
  `fetchProducts({ limit: 1 })` while `HomePage.jsx` calls `fetchProducts({ page, limit: 12 })` —
  two requests per home load and per back-navigation.
  *Fix:* pass the count down, or drop it from the hero; keep the existing honest offline fallback
  ("top-quality products") that refuses to invent a number.
  **Done (Wave D):** `HomePage.jsx` computes `catalogCount` (real `total` only on the default
  unfiltered newest listing, else `null`) and passes it to `<HeroBanner productCount={…}/>`;
  `HeroBanner.jsx` dropped its own fetch/state — fallback text stays "top-quality products" when no
  honest count is available.

- [x] **F-46 · No request caching or dedupe** — P3 · profile tabs and route revisits refetch
  everything. *Fix:* add a minimal cache/dedupe layer (or adopt TanStack Query) once F-43 and F-13
  have landed.
  **Done (Wave D):** interceptor-only cache in `src/api/axios.js` — GETs dedupe in-flight by
  `baseURL|url|sorted-params`, fresh results cached 30s, any mutation clears the cache;
  `csrf-token` and `dataCache: false` requests bypass; 401/403 retry settles bookkeeping before
  re-dispatch so a retry can never join its own deferred; deferred rejections have a sink to avoid
  unhandled-rejection noise. Existing axios tests still pass.

- [x] **F-47 · `console.log` in production, including PII** — P3 ·
  `Frontend/src/hooks/useRazorpayPayment.js` logs `user.email`, cart length and Razorpay options on
  **every render**, plus six more lines per payment. *Fix:* gate behind `import.meta.env.DEV` or
  `logWarn`, matching `Frontend/src/utils/logger.js`.
  **Done (Wave D):** added DEV-gated `logDebug` to `utils/logger.js`; all 7 `console.log` calls in
  `useRazorpayPayment.js` (incl. the PII email) now route through `logDebug`.

- [x] **F-48 · `filterProducts` throws on incomplete products** — P3 ·
  `Frontend/src/utils/products.js` calls `.toLowerCase()` on `p.title` / `p.category`; a product
  missing either field blanks the whole admin page. *Fix:* optional chaining plus `String()`
  coercion.
  **Done (Wave D):** `filterProducts` wraps title/category/brand in `String(… ?? '')`.

- [x] **F-49 · Chunking and Suspense granularity** — P3 · `vite.config.ts` `manualChunks` has a
  catch-all `vendor` bucket, and the single app-level `<Suspense fallback={<Spinner/>}>` flashes a
  spinner on every lazy route. *Fix:* explicit chunks per future heavy library; consider per-route
  fallbacks.
  **Done (Wave D):** `manualChunks` now maps leaflet→`vendor-maps`, recharts/d3→`vendor-charts`,
  socket.io/engine.io→`vendor-socket` (checks ordered before the `react` matcher so react-leaflet
  lands in maps; unmapped code still falls to `vendor`). `App.jsx`: `withErrorBoundary` now wraps
  each lazy component in its own `<Suspense fallback={<Spinner/>}>`, `/faq` wrapped
  (`FaqPageWithError`), outer app-level Suspense removed — Navbar/footer shell never unmounts
  during route lazy-loads (build shows the new buckets).

---

## Phase 7 — Tooling, data authenticity & final QA

- [x] **F-50 · `npm run typecheck` checks nothing** — P2 · `Frontend/tsconfig.json` has
  `"include": ["src"]` but no `allowJs`, so `tsc --noEmit` only sees the two `.ts` files, and
  `Frontend/src/types/index.ts` (147 lines, the full domain model) is imported by zero files —
  while CI reports "typecheck passed". *Fix:* per DEC-4 — enable `allowJs`/`checkJs` incrementally
  and actually import the types, or remove the CI step.
  **Done (Wave E):** `allowJs: true` on since DEC-4 (already caught a duplicate `className` in
  `AdminNotificationsTab.jsx`); the dead `types/index.ts` deleted rather than adopted (F-52); CI
  `frontend-test` job now runs `npm run typecheck` — the step is real and honest. `checkJs`
  stays off until types are adopted file-by-file (DEC-4). Gate: tsc 0 ✅.

- [x] **F-51 · E2E suite cannot run** — P2 · `Frontend/playwright.config.ts` sets
  `testDir: './qa'` but `Frontend/qa` does not exist (the `qa/` folder is at the repo root), and
  `@playwright/test` is not in `devDependencies`. *Fix:* repoint `testDir` and add the dependency,
  or delete the `test:e2e` script.
  **Done (Wave E):** delete-route per locked F-51 — `playwright.config.ts` removed, `test:e2e` /
  `test:e2e:ui` scripts removed, `@playwright/test` uninstalled, CI `e2e` job deleted and deploy
  `needs` updated to `[build]`. Root `qa/` folder untouched.

- [x] **F-52 · Dead code** — P2 · `Frontend/src/types/index.ts` (entire file, unreferenced),
  `utils/format.js → calculateDiscount`, `utils/constants.js → getCategoryCount`,
  `version.js → BUILD_TIME`, and `hooks/useAddresses.js → updateAddress` (referenced only by its
  own export). *Fix:* adopt or delete each.
  **Done (Wave E):** all five deleted (file + empty `types/` dir removed); grep confirms zero
  references. `addressesApi.updateAddress` kept — `saveAddress` uses it.

- [x] **F-53 · Fabricated ratings and reviews shown as real social proof** — P2 ·
  (a) `Frontend/src/data/seedProducts.js` invents ratings and counts (e.g. `Sony WH-1000XM5 →
  4.6/2341`, `PS5 Slim → 4.9/4502`, `Nivea SPF50 → 4.2/5678`) and is injectable from the
  production admin UI; (b) there is **no review system**, yet PDP and ProductCard render
  "Based on N reviews"; (c) `ProductFormModal.jsx` exposes free-text "Rating (0–5)" and
  "Review Count" inputs.
  *Fix:* label the seed set as demo data or remove the seed action from the production admin UI;
  replace review copy with a neutral "Not yet rated" until a real review source exists; make the
  rating fields read-only or clearly admin-only metadata.
  **Never invent** customer counts, sales, testimonials or delivery statistics.
  **Done (Wave E):** (a) `seedProducts.js` carries a DEMO-DATA banner (fabricated ratings are not
  real customer activity), admin button relabelled "Seed Demo Data", confirm dialog repeats the
  disclaimer, seed action already `isProd`-gated in `AdminHeader`; (b) neutral copy: PDP +
  ProductCard show **"Not yet rated"** when count is 0; HomeSections dropped the "real customer"
  claims ("Top rated by customer reviews.", "Most reviewed by customers."); (c)
  `ProductFormModal` rating + review-count are now **read-only metadata** ("Set by customer
  reviews — not editable here"); submit coercion (`?? 0`) unchanged. A real review API exists
  (`reviewRoutes.js`) but is not yet aggregated into `product.rating` — that backend wiring is
  out of this frontend phase's scope.

- [x] **F-54 · Version badge is wrong** — P3 · `Footer.jsx` shows `v1.0.0` from a hardcoded
  `PACKAGE_VERSION` while `package.json` says `0.0.0`; `BUILD_TIME` is exported and unused.
  **Done (Wave E):** `version.js` now derives `PACKAGE_VERSION` from `package.json`
  (`VITE_APP_VERSION` still wins if a pipeline sets it); `BUILD_TIME` deleted (F-52);
  `AdminSettingsTab` version fallback now uses the same `PACKAGE_VERSION` (was a third hardcoded
  `'2.0.0'`).

- [x] **F-55 · Unverifiable claims in the UI** — P3 · `SHIPPING_CONFIG.ESTIMATED_DELIVERY_DAYS =
  '3-5'` (rendered as "Estimated delivery: 3-5 business days"), `SUPPORT_EMAIL =
  support@cartify.com`, an Unsplash stock photo as `og:image`, and `og:url` pointing at
  `cartify-hub.vercel.app`. *Fix:* confirm each reflects reality, or mark/remove it.
  **Done (Wave E):** kept per the locked F-55 decision (business facts are real, keep). All four
  items are owner-confirmable on localhost / deploy config before launch — owner sign-off tracked
  with F-57. Shipping display itself is now honest (ADR 0005 / DEC-1A).

- [x] **F-56 · Test coverage for the audited paths** — P1 · only 6 spec files exist against 65
  source files, all utility-level. Required new suites: `cartContext` (F-03/F-04),
  `useAddresses` (F-01), `useCoupon` (F-04/F-33), `useRazorpayPayment` (F-02/F-09), `Modal`
  (F-37), `ProductCard` (F-06), `AdminOrdersTab` (F-07), `HomePage` URL state (F-12/F-13).
  **Done (Wave E):** all 8 required suites exist — `cartContext.test.jsx` (F-43 split, 2 tests),
  `useAddresses.test.js`, `useCoupon.test.js`, `useRazorpayPayment.test.js`, `Modal.test.jsx`,
  `ProductCard.test.jsx`, `AdminOrdersTab.test.jsx` (4 tests: unit sums, status transitions,
  refund dialog, empty state), `HomePage.test.jsx` (F-12/F-13 URL state, 7 tests). Total suite:
  **30 files / 164 tests, all green**; plus the F-42 axe gate (3 tests).

- [x] **F-57 · Commit/review the uncommitted address work separately** — housekeeping · it
  currently contains F-01 and is mixed with unrelated `Backend/package.json` edits and 4 untracked
  backend image scripts. *Fix:* land it as its own reviewable commit (mostly `Frontend/src`).
  **Done (Wave E):** pushed 2026-09-27 as 4 logical commits on `main` — `0273e6b` (Backend
  F-17/F-18), `5183ba7` (CI F-50/F-51), `74383c4` (Docs F-58), `b799dd9` (Frontend F-01…F-56,
  129 files). All gates green pre-push: FE lint 0 / tsc 0 / 164 tests, BE 179 tests.

- [x] **F-58 · Update project docs** — housekeeping · done: `Docs/BUGS.md` now lists the confirmed
  P0/P1 defects (it previously claimed "No confirmed bugs yet") and `Docs/ROADMAP.md` gained
  Phase 5. Remaining: record the shipping decision as an ADR under `Docs/ADR/`, following
  `Docs/ADR/0003-server-authoritative-payments.md` (blocked on DEC-1), and tick tasks off here as
  they land.
  **Done (Wave E):** `Docs/ADR/0005-honest-shipping-display.md` records DEC-1A (context, decision,
  consequences, DEC-1B deferred path); every task in this file is now ticked with a Done note.

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