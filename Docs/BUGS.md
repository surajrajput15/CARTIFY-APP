# Bug Tracker

> Full frontend audit findings live in [`FRONTEND-AUDIT-TODOS.md`](./FRONTEND-AUDIT-TODOS.md)
> (58 tracked tasks: 4 × P0, 9 × P1, 33 × P2, 12 × P3). This file summarises only the
> confirmed, behaviour-breaking defects.

## Confirmed Bugs

### P0 — Critical

| ID | Bug | File | Impact |
|---|---|---|---|
| F-01 | Deleting the last address leaves it on screen until a hard reload | `Frontend/src/hooks/useAddresses.js` | Stale data; user believes a delete failed |
| F-02 | Displayed total includes ₹79 shipping that the backend never charges | `Frontend/src/utils/constants.js`, `CartPage.jsx`, `CheckoutPage` → `OrderSummary.jsx` | Shown amount ≠ charged amount on every sub-₹999 order |
| F-03 | Cart is not cleared on logout, so the next user's login merges the previous user's items | `Frontend/src/context/cartContext.jsx` | Cross-user data leak |
| F-04 | Coupon code persists in `localStorage` across users | `Frontend/src/hooks/useCoupon.js` | Discount leaks to the next user |
| F-05 | `npm run lint` fails with 6 `no-unused-vars` errors | `Frontend/src/hooks/useAddresses.js:73`, `ProductDetailsPage.jsx:18` | CI `build` + `deploy` jobs never run |

### P1 — High

| ID | Bug | File | Impact |
|---|---|---|---|
| F-06 | Add-to-cart in the product grid gives no user feedback | `Frontend/src/components/ProductCard.jsx` | Users re-click and over-add |
| F-07 | Admin status transitions disagree with the API (`Pending→Shipped` offered but rejected; `Shipped→Cancelled` hidden) | `Frontend/src/components/admin/AdminOrdersTab.jsx` vs `Backend/routes/orderRoutes.js` | Guaranteed 400s and blocked legitimate actions |
| F-11 | Coupon input is shown to guests, but validation requires auth | `Frontend/src/components/checkout/CouponInput.jsx` | Dead-end interaction for guests |
| F-18 | Admin product list is hard-capped at 100 with no pagination | `Frontend/src/pages/AdminPage.jsx` | Products beyond #100 are unmanageable |
| F-37 | `aria-hidden="true"` wraps `role="dialog"`, hiding every modal from assistive tech | `Frontend/src/components/Modal.jsx` | All confirm dialogs unusable with a screen reader |
| F-56 | Only 6 spec files exist against 65 source files (all utility-level) | `Frontend/src/**` | The P0 paths above have no regression protection |

---

## Needs Verification

- **F-02 shipping:** confirm the intended business rule before fixing — remove the fee from the
  display, or implement it server-side (see `DEC-1` in the audit doc).
- **F-03/F-04 logout policy:** confirm whether the local cart should be discarded on logout or
  kept for the same user (see `DEC-2`).
- **F-13 double fetch:** reproduce with `page > 1` and a category change to confirm two API calls.
- **F-26 corrupted placeholder:** re-verify by decoding the base64 constant in
  `CartPage.jsx`, `ProductDetailsPage.jsx`, `ProductTable.jsx` and `ProductFormModal.jsx`.
- **F-37 modal ARIA:** verify with a screen reader (VoiceOver / NVDA) on the delete-product
  confirmation in the admin panel.

---

## Verified as NOT bugs

- `Frontend/.env` is untracked and gitignored — no secret leak.
- The client never sends prices, totals or payment status; the backend recomputes everything.
- Guest browsing produces no 401 console noise (session-hint guard in `api/axios.js`).
- No fake customer counts, testimonials, revenue or discounts exist in the UI.