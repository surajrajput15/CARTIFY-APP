const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Order = require('../models/Order');
const Address = require('../models/Address');
const sendEmail = require('../utils/sendEmail');
const { protect } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Emails are stored lowercased (see User schema setter); every lookup must use the same
// normalized form so register/login/OTP/reset can never diverge by case.
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// Constant-time comparison — mitigates OTP timing attacks regardless of rate limiting.
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

// OTPs are persisted as SHA-256 hashes (defense-in-depth) so a leaked database never
// exposes live codes. Verification compares the hash in constant time. A 6-digit code
// is low-entropy, so this layers on top of rate limiting + attempt lockout, it does
// not replace them.
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// Lower bound for failed OTP attempts before the account's OTP is locked.
const MAX_OTP_ATTEMPTS = 5;

// In-memory per-email OTP send cooldown. Stops email-bombing/DB-pollution of
// passwordless accounts even when the per-IP rate limit is rotated around.
// Single-instance scope is fine here (Render runs one server); it resets on restart.
const otpSendTracker = new Map();
const OTP_SEND_COOLDOWN_MS = 30 * 1000;
const OTP_SEND_MAX_ENTRIES = 10000;

const enforceOtpCooldown = (email) => {
  const now = Date.now();
  const lastSent = otpSendTracker.get(email);
  if (lastSent && now - lastSent < OTP_SEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_SEND_COOLDOWN_MS - (now - lastSent)) / 1000);
    return `Please wait ${wait} second(s) before requesting another OTP.`;
  }
  otpSendTracker.set(email, now);
  // Bounded size: opportunistically prune entries older than the cooldown window.
  if (otpSendTracker.size > OTP_SEND_MAX_ENTRIES) {
    for (const [key, ts] of otpSendTracker) {
      if (now - ts > OTP_SEND_COOLDOWN_MS) otpSendTracker.delete(key);
    }
  }
  return null;
};

// Shared password policy: min 8 chars, at least one upper, lower and digit.
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
};

// ==========================================
// 🚀 NEW: OTP BASED LOGIN SYSTEM
// ==========================================

// 1. SEND OTP API (Send 6-digit code to the email)
router.post('/send-otp', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ message: "Please enter your email." });

        const cooldownMessage = enforceOtpCooldown(email);
        if (cooldownMessage) {
            return res.status(429).json({ message: cooldownMessage });
        }

        // Find the user. If it's a new user, auto-create one (without a password).
        // NOTE: Such an account has no password and can be claimed via /register later —
        // but ONLY after proving email ownership with the OTP sent here (see /register).
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name: 'Cartify User', email });
        }

        // Generate 6-digit OTP (e.g. 482910)
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        // Save the OTP and expiry time (10 mins) to the database — hashed
        user.otp = hashOtp(otp);
        user.otpExpire = Date.now() + 10 * 60 * 1000;
        user.otpAttempts = 0; // Fresh code always resets the brute-force counter
        await user.save();

        // Send the actual email via Nodemailer
        const message = `Welcome to Cartify!\n\nYour Login OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Please do not share it with anyone.`;
        
        await sendEmail({
            email: user.email,
            subject: 'Cartify - Your Login OTP 🔐',
            message: message
        });

        res.status(200).json({ message: "OTP sent successfully to your email! 📩" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error sending OTP. Please try again." });
    }
});

// 2. VERIFY OTP API (Check the email and OTP)
router.post('/verify-otp', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const otp = req.body.otp;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

        const user = await User.findOne({ email });
        // Uniform response whether or not the email has an account, so this endpoint
        // cannot be used to enumerate which emails are registered.
        if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });

        // Lock the OTP after too many failed guesses, even if still within the expiry window.
        if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        // Constant-time compare + expiry check (both sides hashed)
        if (!user.otp || !safeEqual(user.otp, hashOtp(otp)) || user.otpExpire < Date.now()) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({ message: "Invalid or Expired OTP." });
        }

        // OTP is valid! Now clear the OTP from the database (Security)
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpAttempts = 0;
        await user.save();

        // Login successful! Generate token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful! 🎉",
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error("❌ OTP verify error:", error);
        res.status(500).json({ message: "Error verifying OTP." });
    }
});


// ==========================================
// 🗝️ OLD: PASSWORD BASED LOGIN (Fallback)
// ==========================================

router.post('/register', async (req, res) => {
    try {
        const { name, email: rawEmail, password } = req.body;
        if (!name || !rawEmail || !password) return res.status(400).json({ message: "Please fill in all fields." });
        if (typeof name !== 'string' || typeof rawEmail !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: "Please fill in all fields." });
        }

        const email = normalizeEmail(rawEmail);
        if (!email) return res.status(400).json({ message: "Please enter a valid email." });

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            // SECURITY: a passwordless account (created by OTP login) can be claimed
            // ONLY by someone who proves email ownership — a valid, unexpired OTP that
            // was just sent to that email. Without this proof, any attacker could
            // auto-create an account for a victim's email (via /send-otp) and then
            // register a password on it, taking over the identity.
            if (userExists.password) {
                return res.status(400).json({ message: "User already exists." });
            }

            const claimOtp = typeof req.body.otp === 'string' ? req.body.otp : '';
            if (!claimOtp) {
                return res.status(400).json({
                    message: "This email already has an OTP login account. Verify ownership with an OTP to set a password (use the OTP option, or Forgot Password)."
                });
            }
            if (
                !userExists.otp ||
                userExists.otpExpire < Date.now() ||
                !safeEqual(userExists.otp, hashOtp(claimOtp))
            ) {
                return res.status(400).json({ message: "Invalid or expired OTP. Request a new OTP for this email." });
            }

            const salt = await bcrypt.genSalt(10);
            userExists.name = name;
            userExists.password = await bcrypt.hash(password, salt);
            userExists.otp = undefined;
            userExists.otpExpire = undefined;
            userExists.otpAttempts = 0;
            await userExists.save();
            return res.status(201).json({ message: "Account created successfully!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "Account created successfully!" });
    } catch (error) {
        console.error("❌ Registration error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Please enter email and password." });
        const user = await User.findOne({ email });

        // Uniform error for every failure mode (no account / no password / wrong password)
        // so the endpoint never reveals whether an email is registered or how it authenticates.
        if (!user || !user.password) {
            return res.status(400).json({ message: "Invalid credentials. If you have no password yet, use the OTP option." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful!",
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// ==========================================
// 🔄 FORGOT PASSWORD ROUTES
// ==========================================

// 1. SEND RESET OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);

        const cooldownMessage = enforceOtpCooldown(email);
        if (cooldownMessage) {
            return res.status(429).json({ message: cooldownMessage });
        }

        const user = await User.findOne({ email });

        // Always respond with the same message whether or not the account exists, so the
        // endpoint cannot be used to enumerate registered emails.
        if (!user) {
            return res.status(200).json({ message: "If this email is registered, a password reset OTP has been sent." });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        user.otp = hashOtp(otp);
        user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        user.otpAttempts = 0;
        await user.save();

        // Email the OTP
        const message = `You requested a password reset.\n\nYour Password Reset OTP is: ${otp}\n\nIf you did not request this, please ignore this email.`;
        
        await sendEmail({
            email: user.email,
            subject: 'Cartify - Password Reset OTP 🔐',
            message: message
        });

        res.status(200).json({ message: "If this email is registered, a password reset OTP has been sent." });
    } catch (error) {
        console.error("❌ Forgot password OTP error:", error);
        res.status(500).json({ message: "Error sending reset OTP." });
    }
});

// 2. VERIFY OTP AND SET NEW PASSWORD
router.post('/reset-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, OTP and new password are required." });
        }

        const user = await User.findOne({ email });
        // Do not reveal whether the email itself exists — keep the response uniform.
        if (!user || !user.otp) {
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }

        // Lock the OTP after too many failed guesses, even if still within the expiry window.
        if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        // Constant-time compare + expiry check (both sides hashed)
        if (!safeEqual(user.otp, hashOtp(otp)) || user.otpExpire < Date.now()) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        // Clear the OTP fields
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpAttempts = 0;
        await user.save();

        res.status(200).json({ message: "Password reset successful! You can now login." });
    } catch (error) {
        console.error("❌ Reset password error:", error);
        res.status(500).json({ message: "Error resetting password." });
    }
});

// ==========================================
// 👤 USER PROFILE SETTINGS (UPDATE & DELETE)
// ==========================================

// 1. UPDATE PROFILE (Name change)
router.put('/update/:id', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only update your own profile." });
        }

        const newName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!newName) {
            return res.status(400).json({ message: "Name is required and must be non-empty" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { name: newName }, 
            { returnDocument: 'after', runValidators: true }
        );
        
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ 
            message: "Profile updated successfully!", 
            user: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, isAdmin: updatedUser.isAdmin } 
        });
    } catch (error) {
        console.error("❌ Profile update error:", error);
        res.status(500).json({ message: "Error updating profile." });
    }
});

// 2. DELETE ACCOUNT
router.delete('/delete/:id', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only delete your own account." });
        }
        // Cascade: remove the user together with all of their orders and saved addresses so
        // no orphaned personal data (or unusable order history) is left behind.
        await Promise.all([
            User.findByIdAndDelete(req.params.id),
            Order.deleteMany({ userId: req.params.id }),
            Address.deleteMany({ userId: req.params.id })
        ]);
        res.status(200).json({ message: "Account deleted permanently." });
    } catch (error) {
        console.error("❌ Account delete error:", error);
        res.status(500).json({ message: "Error deleting account." });
    }
});
// ==========================================
// 🌐 GOOGLE LOGIN ROUTE
// ==========================================
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: "Google credential is required" });
        }

        // Verify the Google ID Token signature, issuer, audience, expiration,
        // email_verified, and extract the verified payload. Never trust the
        // client-supplied name/email.
        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (error) {
            return res.status(401).json({ message: "Invalid Google credential" });
        }

        const payload = ticket.getPayload();
        if (!payload || !payload.email_verified) {
            return res.status(401).json({ message: "Google email is not verified" });
        }

        // Only fields derived from the verified token payload are used.
        const name = payload.name || '';
        const email = normalizeEmail(payload.email);
        const picture = payload.picture;

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);

            user = new User({
                name,
                email,
                password: hashedPassword
            });
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(500).json({ message: "Google login failed" });
    }
});

module.exports = router;