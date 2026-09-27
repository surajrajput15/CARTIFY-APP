# ADR 0005: Honest Shipping Display (DEC-1A)

## Status
Accepted — 2026-09-26

## Context
`Frontend/src/utils/constants.js` defined `STANDARD_SHIPPING_COST = 79` and
`FREE_SHIPPING_THRESHOLD = 999`; `CartPage` and `OrderSummary` added ₹79 to the
displayed total for orders under ₹999. `Backend/routes/paymentRoutes.js` has no
shipping concept — it computes `Σ(price × qty) − discount` and charges Razorpay
that exact amount. Every sub-₹999 order therefore **displayed more than it
charged**: the checkout CTA, the order summary and the actual payment disagreed.

Pricing that shows one number and charges another fails the project's
"never invent business facts" rule (F-53/F-55 family) even when the invented
part favours the customer.

## Decision
**DEC-1A — remove the fee from the display.**

1. The storefront never adds a shipping surcharge to any displayed total.
2. "Free shipping over ₹999" is retained as marketing copy only (it promises
   something free, never a fee).
3. The payable amount rendered on the CTA comes from the server response —
   same source of truth as ADR 0003 (server-authoritative payments).
4. **DEC-1B** (implementing shipping server-side in `paymentRoutes.js`, the
   `Order` model, refund math and order history) is explicitly deferred; if it
   is ever taken up, the fee must be computed and charged by the server first,
   and only then displayed.

## Consequences

### Positive
- Displayed total === charged total for every order size.
- Checkout and payment can no longer disagree (a class of support tickets
  and failed-payment confusion disappears).
- Aligns with ADR 0003: the client renders amounts the server produced.

### Negative / trade-offs
- Genuine shipping costs (if any) are absorbed rather than passed on until
  DEC-1B is implemented — an accepted, deliberate cost of honesty.
- The marketing threshold (₹999) is now purely aspirational copy; copy must
  never rephrase it as "shipping fee waived" until a fee actually exists.
