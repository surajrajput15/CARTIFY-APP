const express = require('express');
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const { cache } = require('../utils/redisCache');
const router = express.Router();

// Scoped rate limits (shared across /api and /api/v1 mounts since the same
// middleware instances + store are used, keyed by IP):
// - credentialLimiter (5/min): credential-guessing targets — login, register,
//   OTP send/verify, Google login, password reset. Tight on purpose.
// - sessionLimiter (60/min): authenticated session upkeep (/me, /refresh,
//   /logout, profile ops) that fires on every page load — must never starve
//   real logins the way a blanket 5/min router limiter did (429 on /google).
const credentialLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const sessionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Test suites fire dozens of logins from a single IP and would instantly hit
// the credential budget. Bypass is evaluated per-request (not at module load)
// because jest sets NODE_ENV=test in beforeAll, after requires run.
const rateLimitUnlessTest = (limiter) => (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  return limiter(req, res, next);
};
const credentialGuard = rateLimitUnlessTest(credentialLimiter);
const sessionGuard = rateLimitUnlessTest(sessionLimiter);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const sendEmail = require('../utils/sendEmail');
const { applyOwnerRole } = require('../utils/ownerValidator');
const { protect } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { logActivity, activityLogger } = require('../middleware/userActivity');

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// Emails are stored lowercased (see User schema setter); every lookup must use the same
// normalized form so register/login/OTP/reset can never diverge by case.
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// Canonical public user shape returned by every auth endpoint. `role` is derived
// server-side so the frontend RoleGuard can trust a single field; an isAdmin flag
// always implies the admin role. Never includes password/OTP/token material.
const publicUser = (u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    isAdmin: Boolean(u.isAdmin),
    role: u.isAdmin ? 'admin' : (u.role || 'customer'),
    hasPassword: Boolean(u.password),
    createdAt: u.createdAt,
});

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

// Refresh tokens are stored hashed so a DB leak never yields live 7-day sessions.
const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Per-account failed-password tracker (distributed brute-force guard). Complements the
// per-IP credentialLimiter: 10 failures lock the account for 15 min. Bypassed in tests.
const loginFailTracker = new Map();
const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const checkLoginLock = (email) => {
  if (process.env.NODE_ENV === 'test') return null;
  const now = Date.now();
  const entry = loginFailTracker.get(email);
  if (entry && now - entry.firstFail < LOGIN_FAIL_WINDOW_MS && entry.count >= LOGIN_FAIL_LIMIT) {
    const waitMin = Math.ceil((LOGIN_FAIL_WINDOW_MS - (now - entry.firstFail)) / 60000);
    return `Too many failed attempts. Try again in ${waitMin} minute(s).`;
  }
  if (!entry || now - entry.firstFail >= LOGIN_FAIL_WINDOW_MS) loginFailTracker.delete(email);
  return null;
};
const recordLoginFail = (email) => {
  if (process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  // Prune expired windows so the map can't grow unbounded on email floods.
  for (const [key, entry] of loginFailTracker) {
    if (now - entry.firstFail >= LOGIN_FAIL_WINDOW_MS) loginFailTracker.delete(key);
  }
  const entry = loginFailTracker.get(email);
  if (!entry || now - entry.firstFail >= LOGIN_FAIL_WINDOW_MS) {
    loginFailTracker.set(email, { count: 1, firstFail: now });
  } else {
    entry.count += 1;
  }
};
const clearLoginFails = (email) => loginFailTracker.delete(email);

// Lower bound for failed OTP attempts before the account's OTP is locked.
const MAX_OTP_ATTEMPTS = 5;

// In-memory per-email OTP send cooldown. Stops email-bombing/DB-pollution of
// passwordless accounts even when the per-IP rate limit is rotated around.
// OTP send tracker using Redis for distributed-safe cooldown.
// Key pattern: ratelimit:otp:send:{email}
const OTP_SEND_COOLDOWN_MS = 30 * 1000;

// Read-only check: does NOT record anything, so a failed DB save or mail
// failure never blocks the user's legitimate retry.
const checkOtpCooldown = async (email) => {
  const key = `ratelimit:otp:send:${email}`;
  const lastSent = await cache.get(key);
  if (lastSent && Date.now() - lastSent < OTP_SEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_SEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    return `Please wait ${wait} second(s) before requesting another OTP.`;
  }
  return null;
};

// Write path: call ONLY after the OTP mail actually went out.
// Sets TTL so the key auto-expires and can be reused.
const markOtpSent = async (email) => {
  const key = `ratelimit:otp:send:${email}`;
  await cache.set(key, Date.now(), Math.ceil(OTP_SEND_COOLDOWN_MS / 1000));
};

// Shared email format guard — normalizeEmail only trims/lowercases, so without
// this, garbage like "foo" would create a User doc before sendEmail blows up.
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());
// bcrypt silently truncates past 72 bytes — reject huge inputs upfront (DoS guard).
const MAX_PASSWORD_LENGTH = 128;

// Shared password policy: min 8 chars, at least one upper, lower and digit.
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters long`;
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

// Token generation helpers
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Single rotation primitive used by login, OTP verify and refresh: shifts the
// current hash into a 60s grace slot, then installs the new pair. Callers save
// the user doc themselves (they batch it with their other mutations).
const REFRESH_GRACE_MS = 60 * 1000;
const rotateRefreshToken = (user) => {
  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);
  if (user.refreshToken) {
    user.previousRefreshToken = user.refreshToken;
    user.previousRefreshTokenExpire = Date.now() + REFRESH_GRACE_MS;
  }
  user.refreshToken = hashRefreshToken(newRefreshToken);
  user.refreshTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return { newAccessToken, newRefreshToken };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';
  // Split-site production (Vercel -> Render) needs SameSite=None+Secure, or
  // browsers silently drop auth cookies on cross-site API calls (login looks
  // successful but every later call 401s). Localhost stays Lax.
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 min
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
};

const clearAuthCookies = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  // Must match setAuthCookies exactly or the browser keeps the old cookies.
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

// ==========================================
// 🚀 NEW: OTP BASED LOGIN SYSTEM
// ==========================================

// 1. SEND OTP API (Send 6-digit code to the email)
router.post('/send-otp', credentialGuard, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ message: "Please enter your email." });
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        const cooldownMessage = await checkOtpCooldown(email);
        if (cooldownMessage) {
            return res.status(429).json({ message: cooldownMessage });
        }

        // Find the user. If it's a new user, auto-create one (without a password).
        // NOTE: Such an account has no password and can be claimed via /register later —
        // but ONLY after proving email ownership with the OTP sent here (see /register).
        let user = await User.findOne({ email });
        const isNewUser = !user;
        if (!user) {
            user = new User({ name: 'Cartify User', email });
        }

        // Generate 6-digit OTP (e.g. 482910)
        const otp = crypto.randomInt(100000, 1000000).toString();
        
        // Save the OTP and expiry time (10 mins) to the database — hashed
        user.otp = hashOtp(otp);
        user.otpExpire = Date.now() + 10 * 60 * 1000;
        user.otpAttempts = 0; // Fresh code always resets the brute-force counter
        try {
            await user.save();
        } catch (saveError) {
            // Concurrent same-email race: two send-otp at once — one wins, other gets 409.
            if (saveError && saveError.code === 11000) {
                return res.status(409).json({ message: "OTP request already in progress. Please try again." });
            }
            throw saveError;
        }

        // Send the actual email via Nodemailer
        const message = `Welcome to Cartify!\n\nYour Login OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Please do not share it with anyone.`;
        
        try {
            await sendEmail({
                email: user.email,
                subject: 'Cartify - Your Login OTP 🔐',
                message: message
            });
        } catch (mailError) {
            // Don't leave orphan passwordless accounts when the mail provider fails —
            // a newly created user is removed so a retry starts clean.
            if (isNewUser) {
                await User.deleteOne({ _id: user._id }).catch(() => {});
            }
            throw mailError;
        }

        // Cooldown starts only now that the mail actually went out — a failed
        // save/mail above must not block the legitimate retry.
        await markOtpSent(email);

        res.status(200).json({ message: "OTP sent successfully to your email! 📩" });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: "Error sending OTP. Please try again." });
    }
});

// 2. VERIFY OTP API (Check the email and OTP)
router.post('/verify-otp', credentialGuard, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const otp = req.body.otp;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

        const user = await User.findOne({ email });
        // Uniform response whether or not the email has an account, so this endpoint
        // cannot be used to enumerate which emails are registered.
        if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });

        // Lock the OTP after too many failed guesses, but only while it is still
        // valid — the lock implicitly expires with the OTP, and requesting a
        // fresh OTP resets the counter, so users can always self-unlock.
        if (user.otpAttempts >= MAX_OTP_ATTEMPTS && user.otpExpire > Date.now()) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        // Constant-time compare + expiry check (both sides hashed). A missing
        // expiry is treated as expired — never as valid.
        if (!user.otp || !safeEqual(user.otp, hashOtp(otp)) || !user.otpExpire || user.otpExpire < Date.now()) {
            // Atomic increment: concurrent guesses can't race past the attempt cap.
            await User.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
            return res.status(400).json({ message: "Invalid or Expired OTP." });
        }

        // OTP is valid! Now clear the OTP from the database (Security)
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpAttempts = 0;

        // Update last login timestamp
        user.lastLoginAt = new Date();

        // Generate tokens (shared rotation primitive)
        const { newAccessToken: accessToken, newRefreshToken: refreshToken } = rotateRefreshToken(user);
        await user.save();

        // Set HttpOnly cookies
        setAuthCookies(res, accessToken, refreshToken);

        logActivity({ userId: user._id, userEmail: user.email, event: 'AUTH_LOGIN', details: { method: 'otp' }, req });

        res.status(200).json({
            message: "Login successful! 🎉",
            user: publicUser(user)
        });
    } catch (error) {
        logger.error({ err: error }, "❌ OTP verify error:");
        res.status(500).json({ message: "Error verifying OTP." });
    }
});


// ==========================================
// 🗝️ OLD: PASSWORD BASED LOGIN (Fallback)
// ==========================================

router.post('/register', credentialGuard, async (req, res) => {
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
            if ((userExists.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
                return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
            }
            if (
                !userExists.otp ||
                !userExists.otpExpire ||
                userExists.otpExpire < Date.now() ||
                !safeEqual(userExists.otp, hashOtp(claimOtp))
            ) {
                // Atomic increment: concurrent guesses can't race past the cap.
                await User.updateOne({ _id: userExists._id }, { $inc: { otpAttempts: 1 } });
                return res.status(400).json({ message: "Invalid or expired OTP. Request a new OTP for this email." });
            }

            const salt = await bcrypt.genSalt(10);
            userExists.name = name;
            userExists.password = await bcrypt.hash(password, salt);
            userExists.otp = undefined;
            userExists.otpExpire = undefined;
            userExists.otpAttempts = 0;
            await applyOwnerRole(userExists);
            await userExists.save();
            return res.status(201).json({ message: "Account created successfully!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        // Owner allowlist sync: owner lands as admin on first register too.
        await applyOwnerRole(newUser);

        // Generate tokens for auto-login after registration (shared primitive)
        const { newAccessToken: accessToken, newRefreshToken: refreshToken } = rotateRefreshToken(newUser);
        await newUser.save();

        setAuthCookies(res, accessToken, refreshToken);

        logActivity({ userId: newUser._id, userEmail: newUser.email, event: 'AUTH_REGISTER', details: { method: 'password' }, req });

        res.status(201).json({ 
            message: "Account created successfully!",
            user: publicUser(newUser)
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Registration error:");
        res.status(500).json({ message: "Server error during registration." });
    }
});

router.post('/login', credentialGuard, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Please enter email and password." });
        // Non-string passwords (objects/arrays) would crash bcrypt.compare with
        // a 500 — reject as invalid credentials (uniform message, no enumeration).
        if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
            recordLoginFail(email);
            return res.status(400).json({ message: "Invalid credentials. If you have no password yet, use the OTP option." });
        }
        const lockedMessage = checkLoginLock(email);
        if (lockedMessage) return res.status(429).json({ message: lockedMessage });
        const user = await User.findOne({ email });

        // Uniform error for every failure mode (no account / no password / wrong password)
        // so the endpoint never reveals whether an email is registered or how it authenticates.
        if (!user || !user.password) {
            recordLoginFail(email);
            return res.status(400).json({ message: "Invalid credentials. If you have no password yet, use the OTP option." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            recordLoginFail(email);
            return res.status(400).json({ message: "Invalid credentials." });
        }
        clearLoginFails(email);

        // Owner allowlist sync right before token issuance — same rule as
        // google/register: owner is promoted, everyone else stripped.
        await applyOwnerRole(user);

        // Update last login timestamp
        user.lastLoginAt = new Date();

        // Generate tokens (shared rotation primitive)
        const { newAccessToken: accessToken, newRefreshToken: refreshToken } = rotateRefreshToken(user);
        await user.save();

        setAuthCookies(res, accessToken, refreshToken);

        logActivity({ userId: user._id, userEmail: user.email, event: 'AUTH_LOGIN', details: { method: 'password' }, req });

        res.status(200).json({
            message: "Login successful!",
            user: publicUser(user)
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Login error:");
        res.status(500).json({ message: "Server error during login." });
    }
});

// ==========================================
// 🔄 TOKEN REFRESH & LOGOUT
// ==========================================

// Refresh access token using refresh token (with rotation)
router.post('/refresh', sessionGuard, async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        } catch (err) {
            clearAuthCookies(res);
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        if (decoded.type !== 'refresh') {
            clearAuthCookies(res);
            return res.status(401).json({ message: 'Invalid token type' });
        }

        const user = await User.findById(decoded.id).select('+refreshToken +refreshTokenExpire');
        if (!user || !user.refreshToken) {
            clearAuthCookies(res);
            return res.status(401).json({ message: 'Session not found' });
        }

        // Three distinct outcomes — never lumped:
        // 1. Matches current hash: normal rotation.
        // 2. Matches the just-rotated previous hash within its grace window:
        //    benign concurrent retry (double-fire) — rotate again, no wipe.
        // 3. Matches nothing: genuine reuse attack — nuke the session.
        if (!safeEqual(user.refreshToken, hashRefreshToken(refreshToken))) {
            const inGrace =
                user.previousRefreshToken &&
                user.previousRefreshTokenExpire > Date.now() &&
                safeEqual(user.previousRefreshToken, hashRefreshToken(refreshToken));
            if (!inGrace) {
                user.refreshToken = undefined;
                user.refreshTokenExpire = undefined;
                user.previousRefreshToken = undefined;
                user.previousRefreshTokenExpire = undefined;
                await user.save();
                clearAuthCookies(res);
                return res.status(401).json({ message: 'Refresh token revoked. Please login again.' });
            }
        } else if (user.refreshTokenExpire < Date.now()) {
            // Authentic token but past its life: session is simply over.
            // Distinct message (not "revoked") so clients/users aren't misled.
            user.refreshToken = undefined;
            user.refreshTokenExpire = undefined;
            user.previousRefreshToken = undefined;
            user.previousRefreshTokenExpire = undefined;
            await user.save();
            clearAuthCookies(res);
            return res.status(401).json({ message: 'Session expired. Please login again.' });
        }

        // Rotate: generate new access + refresh tokens (previous hash shifts
        // into the grace slot inside the helper).
        const { newAccessToken, newRefreshToken } = rotateRefreshToken(user);
        await user.save();

        setAuthCookies(res, newAccessToken, newRefreshToken);

        res.status(200).json({ message: 'Token refreshed' });
    } catch (error) {
        logger.error({ err: error }, "❌ Token refresh error:");
        clearAuthCookies(res);
        res.status(500).json({ message: "Error refreshing token." });
    }
});

// Logout - clear cookies and invalidate refresh token
router.post('/logout', sessionGuard, async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            try {
                const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
                if (decoded.type === 'refresh' && decoded.id) {
                    logActivity({ userId: decoded.id, userEmail: null, event: 'AUTH_LOGOUT', req });
                    await User.findByIdAndUpdate(decoded.id, { 
                        refreshToken: undefined, 
                        refreshTokenExpire: undefined 
                    });
                }
            } catch (e) {
                // Ignore verification errors, just clear cookies
            }
        }
        clearAuthCookies(res);
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        logger.error({ err: error }, "❌ Logout error:");
        clearAuthCookies(res);
        res.status(200).json({ message: "Logged out successfully" });
    }
});

// ==========================================
// 🔄 FORGOT PASSWORD ROUTES
// ==========================================

// 1. SEND RESET OTP
router.post('/forgot-password', credentialGuard, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ message: "Please enter your email." });
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        const cooldownMessage = await checkOtpCooldown(email);
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

        await markOtpSent(email);

        res.status(200).json({ message: "If this email is registered, a password reset OTP has been sent." });
    } catch (error) {
        logger.error({ err: error }, "❌ Forgot password OTP error:");
        res.status(500).json({ message: "Error sending reset OTP." });
    }
});

// 2. VERIFY OTP AND SET NEW PASSWORD
router.post('/reset-password', credentialGuard, async (req, res) => {
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

        // Lock the OTP after too many failed guesses, but only while it is still
        // valid — the lock implicitly expires with the OTP, and requesting a
        // fresh OTP resets the counter, so users can always self-unlock.
        if (user.otpAttempts >= MAX_OTP_ATTEMPTS && user.otpExpire > Date.now()) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        // Constant-time compare + expiry check (both sides hashed). A missing
        // expiry is treated as expired — never as valid.
        if (!safeEqual(user.otp, hashOtp(otp)) || !user.otpExpire || user.otpExpire < Date.now()) {
            // Atomic increment: concurrent guesses can't race past the attempt cap.
            await User.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
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
        
        // Invalidate existing refresh tokens on password reset
        user.refreshToken = undefined;
        user.refreshTokenExpire = undefined;
        await user.save();

        res.status(200).json({ message: "Password reset successful! You can now login." });
    } catch (error) {
        logger.error({ err: error }, "❌ Reset password error:");
        res.status(500).json({ message: "Error resetting password." });
    }
});

// ==========================================
// 👤 USER PROFILE SETTINGS (UPDATE & DELETE)
// ==========================================

// 1. UPDATE PROFILE (Name change)
router.put('/update/:id', sessionGuard, protect, auditLogMiddleware('UPDATE_PROFILE', 'User'), activityLogger('PROFILE_UPDATE', (req) => ({ field: 'name' })), async (req, res) => {
    try {
        if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
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
            { returnDocument: 'after', runValidators: true, projection: '-otp -otpAttempts -otpExpire -refreshToken -refreshTokenExpire -previousRefreshToken -previousRefreshTokenExpire' }
        );
        
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ 
            message: "Profile updated successfully!", 
            user: publicUser(updatedUser) 
        });
    } catch (error) {
        logger.error({ err: error }, "❌ Profile update error:");
        res.status(500).json({ message: "Error updating profile." });
    }
});

// 2. DELETE ACCOUNT
router.delete('/delete/:id', sessionGuard, protect, auditLogMiddleware('DELETE_ACCOUNT', 'User'), async (req, res) => {
    try {
        if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only delete your own account." });
        }
        // Cascade: remove the user together with all of their orders, cart, saved addresses
        // and coupon usage so no orphaned personal data is left behind.
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(req.params.id);
        await Promise.all([
            User.findByIdAndDelete(req.params.id),
            Order.deleteMany({ userId: userObjectId }),
            Address.deleteMany({ userId: userObjectId }),
            Cart.deleteOne({ userId: userObjectId }),
            Coupon.updateMany(
                { 'usedBy.userId': userObjectId },
                { $pull: { usedBy: { userId: userObjectId } } }
            ),
        ]);
        clearAuthCookies(res);
        res.status(200).json({ message: "Account deleted permanently." });
    } catch (error) {
        logger.error({ err: error }, "❌ Account delete error:");
        res.status(500).json({ message: "Error deleting account." });
    }
});

// 3. CHANGE PASSWORD (authenticated; replaces the email-OTP detour for logged-in users)
router.put('/change-password/:id', sessionGuard, credentialGuard, protect, async (req, res) => {
    try {
        if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only change your own password." });
        }

        const { currentPassword, newPassword } = req.body;
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
            currentPassword.length > MAX_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ message: "Current and new passwords are required." });
        }

        // Throttle repeated guesses from a hijacked session. Keyed with a prefix so
        // these failures never lock the normal login flow for the same email.
        const failKey = `change:${req.user.email}`;
        const lockedMessage = checkLoginLock(failKey);
        if (lockedMessage) return res.status(429).json({ message: lockedMessage });

        // protect strips the password field, so re-read it explicitly here.
        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: "User not found" });

        // Passwordless accounts (OTP/Google signup) cannot "change" a password they
        // don't have — any submitted current password is rejected, and the email
        // OTP reset flow remains the only way to set one (nothing is guessable).
        if (!user.password) {
            recordLoginFail(failKey);
            return res.status(400).json({ message: "No password is set on this account. Use 'Forgot password' on the login page to create one." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            recordLoginFail(failKey);
            return res.status(400).json({ message: "Current password is incorrect." });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) return res.status(400).json({ message: passwordError });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Same hygiene as the OTP reset: rotate refresh tokens so stolen cookies
        // cannot outlive a password change (the 60s grace slot keeps in-flight
        // refreshes from this tab working), then reissue the auth cookie pair.
        const { newAccessToken, newRefreshToken } = rotateRefreshToken(user);
        clearLoginFails(failKey);
        await user.save();

        setAuthCookies(res, newAccessToken, newRefreshToken);

        res.status(200).json({ message: "Password changed successfully!" });
    } catch (error) {
        logger.error({ err: error }, "❌ Change password error:");
        res.status(500).json({ message: "Error changing password." });
    }
});

// ==========================================
// 🌐 GOOGLE LOGIN ROUTE
// ==========================================
router.post('/google', credentialGuard, async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: "Google credential is required" });
        }

        // Misconfigured server (no client ID): fail fast with 503 instead of
        // crashing inside verifyIdToken with a 500.
        if (!googleClient || !process.env.GOOGLE_CLIENT_ID) {
            logger.error('Google login attempted without GOOGLE_CLIENT_ID configured');
            return res.status(503).json({ message: 'Google login is not configured on this server' });
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
        const rawName = typeof payload.name === 'string' ? payload.name.trim() : '';
        const name = rawName || 'Cartify User';
        const email = normalizeEmail(payload.email);
        if (!email) {
            return res.status(401).json({ message: "Google email is not verified" });
        }
        const picture = payload.picture;

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            // Passwordless Google account: no password stored (OTP/password flows still work).
            user = new User({
                name,
                email,
            });
            await user.save();
        }

        // Owner allowlist sync happens right before token issuance: the owner
        // is auto-promoted (fresh Google signups included), everyone else is
        // auto-stripped from admin on every single login.
        await applyOwnerRole(user);

        // Update last login timestamp
        user.lastLoginAt = new Date();

        // Generate tokens (shared rotation primitive)
        const { newAccessToken: accessToken, newRefreshToken: refreshToken } = rotateRefreshToken(user);
        await user.save();

        setAuthCookies(res, accessToken, refreshToken);

        logActivity({ userId: user._id, userEmail: user.email, event: 'AUTH_LOGIN', details: { method: 'google' }, req });

        res.status(200).json({
            user: publicUser(user)
        });
    } catch (error) {
        logger.error({ err: error }, "Google Login Error:");
        res.status(500).json({ message: "Google login failed" });
    }
});

// ==========================================
// 🛡️ CSRF TOKEN ENDPOINT
// ==========================================
router.get('/csrf-token', (req, res) => {
    if (typeof req.csrfToken !== 'function') {
        // Hit via a mount without csurf (e.g. isolated test app) — the real
        // token endpoint lives in server.js ahead of the global CSRF middleware.
        return res.status(404).json({ message: 'CSRF token endpoint not available here' });
    }
    res.status(200).json({ csrfToken: req.csrfToken() });
});

// ==========================================
// 👤 GET CURRENT USER (/me)
// ==========================================
router.get('/me', sessionGuard, protect, async (req, res) => {
    try {
        // protect strips sensitive fields, so hasPassword needs a dedicated read.
        // The password itself is never included in the response — only its presence.
        const me = await User.findById(req.user._id).select('name email isAdmin password createdAt role');
        if (!me) return res.status(404).json({ message: "User not found" });
        res.status(200).json({ user: publicUser(me) });
    } catch (error) {
        logger.error({ err: error }, "❌ /me error:");
        res.status(500).json({ message: "Error fetching user" });
    }
});

module.exports = router;
