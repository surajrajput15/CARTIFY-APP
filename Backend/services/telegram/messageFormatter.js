/**
 * Message Formatter for Telegram Monitoring Alerts
 * Uses clean HTML formatting to avoid Telegram markdown parse errors with underscores.
 */

const { maskEmail } = require('./sanitizer');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  try {
    const ist = d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${ist} IST`;
  } catch (e) {
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }
}

function formatAlertMessage(eventType, data = {}, options = {}) {
  const time = formatTimestamp(data.timestamp || new Date());
  const suppressedNotice = options.suppressedCount > 0
    ? `\n<i>(⚠️ Suppressed ${options.suppressedCount} similar events in cooldown window)</i>`
    : '';

  const buildBody = () => {
    switch (eventType) {
    // ---------------- AUTH EVENTS ----------------
    case 'AUTH_REGISTER':
      return [
        '🟢 <b>NEW CUSTOMER REGISTERED</b>',
        `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.email))}`,
        `⚙️ <b>Method:</b> ${escapeHtml(data.method || 'Password')}`,
        data.ip ? `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip)}</code>` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'AUTH_LOGIN_SUCCESS':
      return [
        data.role === 'admin' || data.isAdmin ? '🛡️ <b>ADMIN LOGIN DETECTED</b>' : '🔑 <b>CUSTOMER LOGIN</b>',
        `👤 <b>User:</b> ${escapeHtml(maskEmail(data.email))}`,
        `⚙️ <b>Method:</b> ${escapeHtml(data.method || 'Password')}`,
        data.ip ? `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip)}</code>` : null,
        data.role === 'admin' || data.isAdmin ? '👑 <b>Access:</b> <b>Full Admin Privileges</b>' : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'AUTH_LOGIN_FAILED':
      return [
        '⚠️ <b>LOGIN FAILED ATTEMPT</b>',
        `👤 <b>Attempted Email:</b> ${escapeHtml(maskEmail(data.email))}`,
        `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `📝 <b>Reason:</b> ${escapeHtml(data.reason || 'Invalid credentials')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    case 'AUTH_LOCKOUT':
      return [
        '🚨 <b>ACCOUNT BRUTE-FORCE LOCKOUT</b>',
        `👤 <b>Target Email:</b> ${escapeHtml(maskEmail(data.email))}`,
        `🌐 <b>Attacker IP:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `⚠️ <b>Security Action:</b> 10 failed attempts reached; account locked for 15 mins`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'AUTH_GOOGLE_SUCCESS':
      return [
        '🌐 <b>GOOGLE OAUTH LOGIN</b>',
        `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.email))}`,
        data.isNewUser ? '✨ <b>Status:</b> New account registered' : '🔁 <b>Status:</b> Existing user login',
        data.ip ? `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip)}</code>` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'AUTH_GOOGLE_FAILED':
      return [
        '🚨 <b>GOOGLE OAUTH FAILURE</b>',
        `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `📝 <b>Reason:</b> ${escapeHtml(data.reason || 'Token verification failed')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'AUTH_LOGOUT':
      return [
        '🚪 <b>USER LOGOUT</b>',
        data.email ? `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.email))}` : null,
        data.userId ? `🆔 <b>User ID:</b> <code>${escapeHtml(data.userId)}</code>` : null,
        data.ip ? `🌐 <b>IP Address:</b> <code>${escapeHtml(data.ip)}</code>` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    // ---------------- ORDER EVENTS ----------------
    case 'ORDER_CREATED':
      return [
        '🛍️ <b>NEW ORDER CREATED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        data.customerEmail ? `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.customerEmail))}` : null,
        `💰 <b>Amount:</b> ₹${Number(data.totalPrice || 0).toFixed(2)}`,
        `💳 <b>Payment:</b> ${escapeHtml(data.paymentStatus || 'Pending')}`,
        `📋 <b>Items:</b> ${data.itemCount || 1} item(s)`,
        data.shippingCity ? `📍 <b>Delivery To:</b> ${escapeHtml(data.shippingCity)}${data.shippingState ? ', ' + escapeHtml(data.shippingState) : ''}` : null,
        data.couponCode ? `🏷️ <b>Coupon:</b> <code>${escapeHtml(data.couponCode)}</code>` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'ORDER_PAID':
      return [
        '✅ <b>ORDER CONFIRMED & PAID</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        data.customerEmail ? `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.customerEmail))}` : null,
        `💰 <b>Verified Amount:</b> ₹${Number(data.totalPrice || 0).toFixed(2)}`,
        `💳 <b>Provider Ref:</b> <code>${escapeHtml(data.paymentId || 'N/A')}</code>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'ORDER_CANCELLED':
      return [
        '❌ <b>ORDER CANCELLED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        data.customerEmail ? `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.customerEmail))}` : null,
        `👤 <b>Cancelled By:</b> ${escapeHtml(data.cancelledBy || 'Customer')}`,
        `💰 <b>Order Total:</b> ₹${Number(data.totalPrice || 0).toFixed(2)}`,
        `🔄 <b>Stock Restored:</b> ${data.stockRestored ? 'Yes' : 'No'}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'ORDER_STATUS_CHANGED':
      return [
        '🔄 <b>ORDER STATUS UPDATED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `📊 <b>Transition:</b> <code>${escapeHtml(data.fromStatus || 'N/A')}</code> ➔ <b>${escapeHtml(data.toStatus)}</b>`,
        `👤 <b>Updated By:</b> ${escapeHtml(data.updatedBy || 'System')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'DELIVERY_UPDATE':
      return [
        '🚚 <b>DELIVERY UPDATE</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `📍 <b>Milestone:</b> <b>${escapeHtml(data.deliveryStatus)}</b>`,
        data.partnerName ? `🛵 <b>Partner:</b> ${escapeHtml(data.partnerName)}` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'ORDER_STOCK_SHORTFALL':
      return [
        '⚠️ <b>STOCK SHORTFALL DETECTED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `💰 <b>Captured Amount:</b> ₹${Number(data.totalPrice || 0).toFixed(2)}`,
        `🚨 <b>Status:</b> Payment succeeded but stock reservation failed!`,
        `🛠️ <b>Action Needed:</b> Admin must review and initiate refund.`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    // ---------------- PAYMENT & REFUND EVENTS ----------------
    case 'PAYMENT_INITIATED':
      return [
        '💳 <b>PAYMENT INITIATED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `🔗 <b>Razorpay Order:</b> <code>${escapeHtml(data.razorpayOrderId)}</code>`,
        `💰 <b>Amount:</b> ₹${Number(data.totalPrice || 0).toFixed(2)}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'PAYMENT_VERIFIED_SUCCESS':
      return [
        '💳 <b>PAYMENT VERIFIED (SERVER-SIDE)</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        data.customerEmail ? `👤 <b>Customer:</b> ${escapeHtml(maskEmail(data.customerEmail))}` : null,
        `💰 <b>Verified Amount:</b> ₹${Number(data.amount || data.totalPrice || 0).toFixed(2)} INR`,
        `💳 <b>Payment ID:</b> <code>${escapeHtml(data.paymentId)}</code>`,
        `🔒 <b>Verification:</b> Constant-time HMAC match & Gateway re-check passed`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'PAYMENT_VERIFY_FAILED':
      return [
        '🚨 <b>PAYMENT VERIFICATION FAILED</b>',
        `📦 <b>Razorpay Order:</b> <code>${escapeHtml(data.razorpayOrderId || 'Unknown')}</code>`,
        `📝 <b>Reason:</b> ${escapeHtml(data.reason || 'Signature mismatch or gateway rejection')}`,
        `🌐 <b>IP:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'PAYMENT_WEBHOOK_CAPTURED':
      return [
        '⚡ <b>WEBHOOK: PAYMENT CAPTURED</b>',
        `📦 <b>Razorpay Order:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `💳 <b>Payment ID:</b> <code>${escapeHtml(data.paymentId)}</code>`,
        `💰 <b>Amount:</b> ₹${Number(data.amount || 0).toFixed(2)}`,
        `⚙️ <b>Transition:</b> ${escapeHtml(data.transition || 'Reconciled')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'SECURITY_INVALID_WEBHOOK_SIGNATURE':
      return [
        '🚨 <b>SECURITY ALERT: INVALID WEBHOOK SIGNATURE</b>',
        `🌐 <b>IP:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `⚠️ <b>Event:</b> Rejected unauthorized payment webhook!`,
        `🔒 <b>Action:</b> Dropped without processing.`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'PAYMENT_WEBHOOK_MISMATCH':
      return [
        '🚨 <b>SECURITY ALERT: WEBHOOK AMOUNT MISMATCH</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `Expected: ₹${data.expectedAmount} | Received: ₹${data.receivedAmount}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'REFUND_PROCESSED':
      return [
        '💸 <b>REFUND PROCESSED (VERIFIED)</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `💰 <b>Refunded Amount:</b> ₹${Number(data.amount || 0).toFixed(2)}`,
        `🧾 <b>Refund Ref:</b> <code>${escapeHtml(data.refundId)}</code>`,
        `👤 <b>Initiated By:</b> ${escapeHtml(data.adminEmail || 'Admin')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'REFUND_FAILED':
      return [
        '🚨 <b>REFUND ATTEMPT FAILED</b>',
        `📦 <b>Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
        `📝 <b>Gateway Error:</b> ${escapeHtml(data.error || 'Unknown')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    // ---------------- ADMIN & INVENTORY EVENTS ----------------
    case 'PRODUCT_MUTATION':
      return [
        '📦 <b>PRODUCT CATALOG UPDATE</b>',
        `⚙️ <b>Action:</b> ${escapeHtml(data.action)}`,
        `🏷️ <b>Title:</b> ${escapeHtml(data.title)}`,
        data.price ? `💰 <b>Price:</b> ₹${data.price}` : null,
        data.stock !== undefined ? `📊 <b>Stock:</b> ${data.stock}` : null,
        `👤 <b>Admin:</b> ${escapeHtml(maskEmail(data.adminEmail))}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].filter(Boolean).join('\n');

    case 'STOCK_ADJUSTED':
      return [
        '📊 <b>STOCK ADJUSTMENT</b>',
        `📦 <b>Product:</b> <code>${escapeHtml(data.productId)}</code>`,
        `🏢 <b>Warehouse:</b> ${escapeHtml(data.warehouseName || data.warehouseId)}`,
        `🔢 <b>Delta:</b> ${data.delta > 0 ? '+' : ''}${data.delta} (New Balance: ${data.balanceAfter})`,
        `📝 <b>Note:</b> ${escapeHtml(data.note || 'Manual edit')}`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'INVENTORY_LOW_STOCK':
      return [
        '⚠️ <b>LOW STOCK ALERT</b>',
        `🏷️ <b>Product:</b> ${escapeHtml(data.title)}`,
        `📉 <b>Current Stock:</b> <b>${data.quantity}</b> (Threshold: ${data.threshold})`,
        data.warehouse ? `🏢 <b>Warehouse:</b> ${escapeHtml(data.warehouse)}` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    case 'SECURITY_UNAUTHORIZED_ADMIN':
      return [
        '🚨 <b>UNAUTHORIZED ADMIN ACCESS ATTEMPT</b>',
        `👤 <b>User:</b> ${escapeHtml(maskEmail(data.email))}`,
        `🌐 <b>IP:</b> <code>${escapeHtml(data.ip || 'Unknown')}</code>`,
        `📍 <b>Route:</b> <code>${escapeHtml(data.path)}</code>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    case 'SECURITY_RATE_LIMIT_HIT':
      return [
        '🛑 <b>RATE LIMIT TRIGGERED</b>',
        `🌐 <b>IP:</b> <code>${escapeHtml(data.ip)}</code>`,
        `📍 <b>Route Scope:</b> <code>${escapeHtml(data.route || 'General API')}</code>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    case 'SECURITY_CSRF_VIOLATION':
      return [
        '🛡️ <b>CSRF VALIDATION FAILED</b>',
        `🌐 <b>IP:</b> <code>${escapeHtml(data.ip)}</code>`,
        `📍 <b>Path:</b> <code>${escapeHtml(data.path)}</code>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'DB_DISCONNECTED':
      return [
        '🔥 <b>CRITICAL: MONGODB DISCONNECTED</b>',
        `⚠️ <b>State:</b> Database connection lost. Driver auto-reconnect running.`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    case 'DB_RECONNECTED':
      return [
        '✅ <b>MONGODB RECONNECTED</b>',
        `🟢 <b>State:</b> Database connectivity successfully restored.`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');

    case 'SYSTEM_ERROR':
      return [
        '🔥 <b>SERVER UNHANDLED EXCEPTION</b>',
        `❌ <b>Error:</b> <code>${escapeHtml(data.message || data.error || 'Unknown error')}</code>`,
        `📍 <b>Path:</b> <code>${escapeHtml(data.path || 'Process')}</code>`,
        data.stack ? `<pre>${escapeHtml(data.stack)}</pre>` : null,
        data.data ? `<pre>${escapeHtml(JSON.stringify(data.data, null, 2))}</pre>` : null,
        `🕒 <b>Time:</b> <code>${time}</code>`,
        suppressedNotice,
      ].filter(Boolean).join('\n');

    default:
      return [
        `ℹ️ <b>MONITORING EVENT: ${escapeHtml(eventType)}</b>`,
        `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
        `🕒 <b>Time:</b> <code>${time}</code>`,
      ].join('\n');
    }
  };

  let body = buildBody();
  if (body && body.length > 4000) {
    body = body.substring(0, 3900) + '\n\n<i>[Message truncated for Telegram length limit]</i>';
  }
  return body;
}

module.exports = {
  formatAlertMessage,
  escapeHtml,
  formatTimestamp,
};
