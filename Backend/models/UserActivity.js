const mongoose = require('mongoose');

// UserActivity = behaviour timeline for the admin "user activity" view (B4/B5).
// This is NOT the compliance audit trail (AuditLog): events here describe what
// a customer did (logins, product views, cart writes, checkout, wishlist),
// stored small (ids + counts, never full bodies) and kept for 90 days.
const userActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userEmail: { type: String, default: null },
  // Stable event names, e.g. AUTH_LOGIN, PRODUCT_VIEW, CART_SYNC,
  // CHECKOUT_START, CHECKOUT_COMPLETE, WISHLIST_ADD, PROFILE_UPDATE.
  event: { type: String, required: true, index: true },
  // Small structured context: { productId }, { itemCount }, { total },
  // { method: 'password'|'otp'|'google' } — never passwords, tokens or PII.
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: false });

userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ event: 1, timestamp: -1 });
userActivitySchema.index({ timestamp: -1 });

// TTL — behaviour data is operational, not archival: auto-delete after 90 days
// so the collection can't grow unbounded.
userActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
