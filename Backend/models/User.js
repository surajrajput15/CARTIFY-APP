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
    }
}, { timestamps: true });

// Indexes (email unique index is auto-created from `unique: true` on the field)
userSchema.index({ isAdmin: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ refreshToken: 1 });

module.exports = mongoose.model('User', userSchema);