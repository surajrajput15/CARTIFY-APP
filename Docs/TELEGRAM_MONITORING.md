# Cartify — Private Telegram Monitoring System

A zero-footprint, resilient, private monitoring and alerting system for Cartify's backend infrastructure, transaction lifecycle, inventory health, and security boundaries.

---

## 1. Architectural Principles

1. **Zero UI & Zero Bundle Footprint**:
   - The monitoring system is entirely backend-native.
   - No frontend code, links, buttons, bot handles, or telemetry scripts are exposed to end users.
   - Frontend bundles contain zero references to Telegram.

2. **Strictly Private 1-to-1 Notifications**:
   - Notifications are routed strictly to the administrator's private `TELEGRAM_CHAT_ID`.
   - The client verifies destination chat IDs against `process.env.TELEGRAM_CHAT_ID` and drops any message targeted to unapproved chats.

3. **Asynchronous Non-Blocking & Fail-Open**:
   - All dispatches are scheduled via `setImmediate()` to ensure Express request-response lifecycles return immediately.
   - Core customer operations (checkout, payment verification, login, registration) **never** fail or slow down if Telegram API is unreachable or rate-limited.

4. **Data Privacy & Deep Sanitization**:
   - **Credentials & Tokens**: Passwords, OTPs, JWTs, card numbers, CVVs, and raw payment signatures are stripped or marked `[REDACTED]`.
   - **PII Masking**: Customer emails (e.g. `s****5@gmail.com`), phone numbers (`******3210`), and billing street addresses are masked before transmission.

5. **Alert Throttling & Cooldowns**:
   - Brute-force login attempts, rate-limit hits, inventory warnings, and system errors are subject to dedicated cooldown windows.
   - When cooldown expires, the subsequent alert includes a badge summarizing suppressed events (e.g., `(⚠️ Suppressed 5 similar events in cooldown window)`).

6. **Audit Persistence**:
   - All monitoring events are stored in the MongoDB `monitoringlogs` collection with a 90-day TTL index.

---

## 2. Environment Variables

Configure these variables in `Backend/.env` (local) and Render Dashboard (production):

| Variable | Required | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Yes | Token provided by @BotFather | `8990376774:AAGJq3swngi1lW0K3C0OScBsLU1Wz0zgd2A` |
| `TELEGRAM_CHAT_ID` | Yes | Admin's private numeric chat ID | `123456789` |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | No | Master switch for Telegram alerts | `true` (default: `true`) |

> [!IMPORTANT]
> Never commit `Backend/.env` to Git. Keep `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` strictly in your deployment environment settings.

---

## 3. Quick Start & Verification

### Step 1: Initialize Chat with the Bot
1. Open Telegram and search for: **`@CartifyAlerts_Bot`**
2. Click **Start** or send the message `/start`.

### Step 2: Detect Your Chat ID
Run the verification script from the `Backend` directory:
```bash
node scripts/verifyTelegramBot.js
```
The script calls `getUpdates` from Telegram and outputs:
```
Detected incoming messages:
  - From: Suraj (username: surajrajput15) | Chat ID: 123456789 | Text: "/start"

RECOMMENDED ACTION:
Add this to your Backend/.env:
TELEGRAM_CHAT_ID=123456789
```

### Step 3: Configure Environment
Add `TELEGRAM_CHAT_ID=<your_chat_id>` to `Backend/.env`.

### Step 4: Send a Test Notification
Validate end-to-end delivery:
```bash
node scripts/verifyTelegramBot.js --test
```
You will receive a test message directly in Telegram from `@CartifyAlerts_Bot`.

---

## 4. Event Catalog & Severity Matrix

| Event Type | Severity | Throttle Window | Trigger Point |
| :--- | :---: | :---: | :--- |
| **`AUTH_REGISTER`** | `LOW` | None | New customer registered (`/api/auth/register`) |
| **`AUTH_LOGIN_SUCCESS`** | `INFO` | None | Successful user/admin login (`/api/auth/login`) |
| **`AUTH_LOGIN_FAILED`** | `MEDIUM` | 1 minute / identity | Bad credentials entered (`/api/auth/login`) |
| **`AUTH_LOCKOUT`** | `CRITICAL` | 2 minutes / identity | 10 consecutive failures (15m account lock) |
| **`AUTH_GOOGLE_SUCCESS`** | `INFO` | None | Google OAuth successful login/signup |
| **`AUTH_GOOGLE_FAILED`** | `MEDIUM` | 1 minute / IP | Google OAuth token verification failure |
| **`AUTH_LOGOUT`** | `INFO` | None | User logout |
| **`ORDER_CREATED`** | `MEDIUM` | None | Checkout order created (`/api/payment/create-order`) |
| **`ORDER_PAID`** | `MEDIUM` | None | Order marked paid upon payment verification |
| **`ORDER_CANCELLED`** | `MEDIUM` | None | Customer or admin cancels an order |
| **`ORDER_STATUS_CHANGED`** | `LOW` | None | Order state transition (Processing -> Shipped) |
| **`DELIVERY_UPDATE`** | `LOW` | None | Milestone updated / delivery partner assigned |
| **`PAYMENT_INITIATED`** | `INFO` | None | Razorpay order generated |
| **`PAYMENT_VERIFIED_SUCCESS`** | `HIGH` | None | Constant-time HMAC passed & gateway re-checked |
| **`PAYMENT_VERIFY_FAILED`** | `HIGH` | None | HMAC signature mismatch or gateway verification failed |
| **`ORDER_STOCK_SHORTFALL`** | `CRITICAL` | None | Payment succeeded but inventory reservation failed |
| **`PAYMENT_WEBHOOK_CAPTURED`** | `HIGH` | None | Razorpay webhook `payment.captured` received |
| **`PAYMENT_WEBHOOK_MISMATCH`** | `HIGH` | None | Webhook payload mismatch vs database order state |
| **`REFUND_PROCESSED`** | `HIGH` | None | Razorpay refund initiated and recorded |
| **`REFUND_FAILED`** | `HIGH` | None | Refund API call failure |
| **`INVENTORY_LOW_STOCK`** | `MEDIUM` | 15 minutes / product | Available quantity drops below threshold (<5) |
| **`STOCK_ADJUSTED`** | `LOW` | None | Manual or bulk stock replenishment |
| **`PRODUCT_MUTATION`** | `LOW` | None | Product created, modified, or archived by admin |
| **`SECURITY_UNAUTHORIZED_ADMIN`** | `HIGH` | 1 minute / IP | Non-admin or unprivileged user hits admin endpoint |
| **`SECURITY_CSRF_VIOLATION`** | `HIGH` | 1 minute / IP | Invalid or missing CSRF token on mutation |
| **`SECURITY_RATE_LIMIT_HIT`** | `MEDIUM` | 3 minutes / IP | General or Auth credential rate limit breached |
| **`SECURITY_INVALID_WEBHOOK_SIGNATURE`** | `CRITICAL` | None | Forged or invalid Razorpay webhook signature |
| **`DB_DISCONNECTED`** | `CRITICAL` | 5 minutes | Mongoose connection dropped |
| **`DB_RECONNECTED`** | `INFO` | None | MongoDB connection re-established |
| **`SYSTEM_ERROR`** | `CRITICAL` | 2 minutes / error | Unhandled rejection, uncaught exception, or 500 |

---

## 5. Operations & Maintenance

### Rotating Bot Token
If the bot token is ever exposed:
1. Open `@BotFather` in Telegram.
2. Send `/revoke` and select `@CartifyAlerts_Bot`.
3. Copy the new token.
4. Update `TELEGRAM_BOT_TOKEN` in Render Dashboard under **Environment Variables**.
5. Render will automatically redeploy the backend with the new token.

### Disabling Alerts During Maintenance
To silence alerts during major migrations or load testing:
- Set `TELEGRAM_NOTIFICATIONS_ENABLED=false` in the backend environment.
- The backend continues normal operations; alerts are cleanly bypassed without errors.

### Inspecting Historical Monitoring Logs
All events are persisted in MongoDB. You can query them anytime via Mongo shell or Compass:
```javascript
// Check critical alerts from the past 24 hours
db.monitoringlogs.find({
  severity: "CRITICAL",
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).sort({ timestamp: -1 });

// Check throttled events
db.monitoringlogs.find({ deliveryStatus: "THROTTLED" });
```
