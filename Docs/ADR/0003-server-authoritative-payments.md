# ADR 0003: Server-Authoritative Payments

## Status
Accepted

## Date
2026-01-15

## Context
The original payment flow accepted the total amount from the client. This is a critical security vulnerability:
- Malicious users could send `$0.01` instead of the actual amount
- Stale product prices could be exploited
- Cart manipulation could lead to free or discounted purchases

The payment gateway (Razorpay) is the source of truth for the actual amount charged. The server must compute the final price from authoritative product data.

## Decision
Implement server-authoritative payment processing with the following flow:

1. **Client submits**: Product IDs + quantities + shipping address (NO prices, NO totals)
2. **Server validates**: All products exist, have valid prices, stock is available
3. **Server computes**: Total price from product data
4. **Server creates**: Razorpay order with computed amount
5. **Server persists**: Pending order record linked to Razorpay order ID
6. **Client pays**: Via Razorpay checkout
7. **Server verifies**: HMAC SHA256 signature matches expected
8. **Server reconciles**: Fetches Razorpay order, verifies amount matches
9. **Server finalises**: Atomic transition to Paid + stock reservation
10. **Webhook safety net**: If client disconnects, webhook finalises the order

Additional safeguards:
- Stock reservation with atomic `$gte` filter
- Compensating `$inc` on stock shortfall
- Idempotent payment verification (replay-safe)
- Webhook for server-to-server reconciliation

## Consequences

### Positive
- Price manipulation is impossible
- Stale prices are always reconciled
- Concurrent stock depletion is handled correctly
- Lost payments are recovered via webhook
- Replay attacks are prevented via idempotency

### Negative
- Server load increases (extra Razorpay API calls for verification)
- More complex flow to maintain
- Requires careful transaction handling

### Mitigations
- Idempotency keys for Razorpay API calls
- TTL on pending orders (24h) prevents unbounded growth
- Atomic MongoDB operations for stock updates
- Clear error messages for common failure modes

## Alternatives Considered

1. **Client-computed totals with server validation**: Race condition window between validation and payment
2. **Cryptographic signatures on client requests**: Complex, doesn't prevent all attacks
3. **Third-party payment orchestrators (e.g., Stripe Checkout)**: More expensive, less control

## References
- [Razorpay Integration Guide](https://razorpay.com/docs/api/)
- [OWASP Payment Security](https://owasp.org/www-project-payment-security/)
- [Idempotency Patterns](https://stripe.com/docs/api/idempotent_requests)