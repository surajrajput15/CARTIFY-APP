const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient } = require('./redisCache');

// Helper to create a Redis-backed rate limiter (if Redis is available)
const createLimiter = (options) => {
  const { windowMs, max, message, keyPrefix = 'rl:' } = options;
  const config = {
    windowMs,
    max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?._id
        ? `${keyPrefix}user:${req.user._id}`
        : `${keyPrefix}ip:${req.ip}`;
    },
  };

  // Try to use Redis store, fall back to memory store
  try {
    const client = getRedisClient();
    config.store = new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: keyPrefix,
    });
  } catch (error) {
    // Fall back to in-memory store if Redis is unavailable
    console.warn('Using in-memory rate limit store (Redis unavailable)');
  }

  return rateLimit(config);
};

// Strict rate limit for auth endpoints (5 req/min)
const authLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Please try again after a minute.',
  keyPrefix: 'rl:auth:',
});

// Medium rate limit for payment endpoints (10 req/min)
const paymentLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Too many payment requests. Please slow down.',
  keyPrefix: 'rl:payment:',
});

// Strict rate limit for admin endpoints (30 req/min)
const adminLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: 'Too many admin requests. Please slow down.',
  keyPrefix: 'rl:admin:',
});

// General API rate limit (200 req/min)
const apiLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: 'Too many requests. Please try again later.',
  keyPrefix: 'rl:api:',
});

// Product listing rate limit (60 req/min - can be higher for read)
const productLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many product requests. Please slow down.',
  keyPrefix: 'rl:product:',
});

// OTP send rate limit (3 req/min - prevent abuse)
const otpLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please try again after a minute.',
  keyPrefix: 'rl:otp:',
});

module.exports = {
  authLimiter,
  paymentLimiter,
  adminLimiter,
  apiLimiter,
  productLimiter,
  otpLimiter,
  createLimiter,
};