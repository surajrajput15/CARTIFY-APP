const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        // Normalize on save so case-only differences ("John@X.com" vs "john@x.com") can never
        // create duplicate accounts or block logins.
        set: (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)
    },
    password: {
        type: String,
        // Password is optional because a user can also log in with OTP alone.
        required: false
    },
    // Contact number. Optional, but delivery partners need one so customers/admin can
    // reach them about an in-flight order. Format is validated at the route layer
    // (utils/normalize.normalizeIndianPhone), matching Address/Order.
    phone: {
        type: String,
        default: null,
        trim: true
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'delivery', 'warehouse'],
        default: 'customer'
    },
    // Warehouse-staff only: which warehouse this user manages. Set by an admin
    // when creating/promoting a warehouse partner; scopes every warehouse portal
    // route so staff can only see/edit their own warehouse's stock.
    assignedWarehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        default: null
    },
    // Account lifecycle state for admin user-management (D4.1). The OWNER is
    // never blocked/deactivated — ownerValidator/status routes enforce that.
    //   active      — normal account, can log in
    //   blocked     — suspended temporarily by admin (blockReason shown to user)
    //   deactivated — closed by user/admin (graceful) — can be re-activated
    status: {
        type: String,
        enum: ['active', 'blocked', 'deactivated'],
        default: 'active'
    },
    blockReason: {
        type: String,
        default: null,
        trim: true
    },
    blockedAt: {
        type: Date,
        default: null
    },
    deactivatedAt: {
        type: Date,
        default: null
    },
    // Denormalised last successful login (set in auth routes on every login).
    // Full login HISTORY lives in UserActivity (AUTH_LOGIN events, 90d TTL).
    lastLoginAt: {
        type: Date,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    // OTP fields
    // otp stores the SHA-256 hash of the code (never the plaintext), see authRoutes.
    otp: {
        type: String,
        default: null
    },
    otpExpire: {
        type: Date,
        default: null
    },
    // Brute-force guard: counts consecutive failed OTP verifications for this account.
    // Reset whenever a fresh OTP is issued.
    otpAttempts: {
        type: Number,
        default: 0
    },
    // Refresh token fields for JWT rotation
    refreshToken: {
        type: String,
        default: null
    },
    refreshTokenExpire: {
        type: Date,
        default: null
    },
    // Grace window for concurrent refresh double-fires (StrictMode, retries):
    // the just-rotated-out token stays acceptable for 60s so a benign retry
    // is never mistaken for a reuse attack.
    previousRefreshToken: {
        type: String,
        default: null
    },
    previousRefreshTokenExpire: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Indexes (email unique index is auto-created from `unique: true` on the field)
userSchema.index({ isAdmin: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ assignedWarehouseId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ refreshToken: 1 });

module.exports = mongoose.model('User', userSchema);