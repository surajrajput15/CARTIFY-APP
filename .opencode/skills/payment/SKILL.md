# Payment Skill

## When to use
Any task involving payments — Razorpay integration, order processing, webhooks, refunds.

## Key files
- `Backend/routes/paymentRoutes.js` — All Razorpay endpoints
- `Backend/utils/orderFulfillment.js` — Order finalization logic
- `Frontend/src/hooks/useRazorpayPayment.js` — Frontend Razorpay hook
- `Frontend/src/components/checkout/OrderSummary.jsx` — Payment button
- `Frontend/src/pages/CheckoutPage.jsx` — Checkout flow

## Razorpay Test Mode Setup

### Backend (.env)
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_test_secret
```

### Frontend (.env)
```
VITE_RAZORPAY_KEY=rzp_test_xxxxxxxxxxxx
```

**Critical**: Frontend and backend keys MUST match exactly.

### Get Test Keys
1. Go to https://dashboard.razorpay.com
2. Toggle to **Test Mode** (top-left)
3. Settings → API Keys → Generate Test Key
4. Copy Key ID and Secret

## Payment Flow

### 1. Create Order (Frontend → Backend)
- `POST /api/payment/create-order` with `{ items: [{productId, quantity}], shippingAddress }`
- Backend validates items against MongoDB
- Backend creates Pending order in MongoDB
- Backend calls Razorpay API to create Razorpay order
- Returns Razorpay order ID

### 2. User Pays (Razorpay Checkout)
- Frontend opens Razorpay checkout with order ID
- User completes payment (test card: 4111 1111 1111 1111)
- Razorpay returns payment response to frontend

### 3. Verify Payment (Frontend → Backend)
- `POST /api/payment/verify-payment` with Razorpay response
- Backend verifies HMAC SHA256 signature
- Backend checks amount matches
- Backend calls `finalisePaidOrder()` to:
  - Update order status to Paid
  - Decrement product stock atomically
  - If stock insufficient, mark as `stockShortfall` for refund

### 4. Webhook (Backup)
- `POST /api/payment/webhook` — Razorpay server-to-server
- Excluded from CSRF (uses signature verification)
- Finalises order if client verification didn't complete

## CSRF for Payment Routes
- `/api/payment/create-order` — requires CSRF token
- `/api/payment/webhook` — excluded from CSRF (Razorpay signature)
- `/api/payment/verify-payment` — requires CSRF token
- `/api/payment/refund/:orderId` — requires CSRF + admin

## Common Issues

### "lumberjack.razorpay.com/v2/logz" 403
- Razorpay analytics endpoint, blocked by adblockers
- Not critical, can be ignored
- To fix: disable adblocker for localhost

### Razorpay not opening
1. Check `VITE_RAZORPAY_KEY` matches `RAZORPAY_KEY_ID`
2. Verify both are test mode keys (`rzp_test_*`)
3. Check browser console for errors
4. Verify backend `RAZORPAY_KEY_SECRET` is correct

### Payment verification fails
1. Check `RAZORPAY_KEY_SECRET` is correct
2. Verify HMAC signature generation
3. Check amount matches between order and payment

### Order not finalising
1. Check `finalisePaidOrder()` in `Backend/utils/orderFulfillment.js`
2. Verify stock decrement logic
3. Check for `stockShortfall` flag (means stock was insufficient)

## Localhost HTTPS
Razorpay works with `http://localhost` for test mode. No HTTPS needed for local dev.

For production, use HTTPS and whitelist Razorpay IPs in firewall.

## Test Cards
- Success: `4111 1111 1111 1111`, any future expiry, any CVV
- Failure: `4000 0000 0000 0002`
- More: https://razorpay.com/docs/payments/test-cards/

## Refund Flow
- `POST /api/payment/refund/:orderId` — Admin only
- Backend calls Razorpay refund API
- Updates order to `Refunded` status
- Sets `refundId` on order

## Stock Management
- Stock is decremented atomically when payment is verified
- If insufficient stock, order is marked `stockShortfall: true`
- Admin can then refund via `/api/payment/refund/:orderId`
- Stock check: `product.countInStock >= quantity` before decrement
