// Scoped rate limiters for high-sensitivity operational routes (Phase C1).
// These are middleware guards applied to the MUTATION routes of admin, delivery
// partner and warehouse staff surfaces. Read/GET routes keep the generic
// 200/min limiter from server.js; tight budgets here specifically throttle
// state-changing abuse (bulk stock edits, transfer loops, delivery spam).
//
// Test mode: jest fires many mutations from one IP and would hit these budgets
// instantly, so guards short-circuit when NODE_ENV === 'test' (evaluated
// per-request, because jest sets the env after requires have run — see the
// same pattern in authRoutes.js).
const rateLimit = require('express-rate-limit');

const adminMutateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { message: 'Too many admin changes. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Delivery lifecycle (accept/pickup/out/complete/fail) + warehouse stock
// mutations (set quantity / transfer) — very low legitimate volume.
const staffActionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const skipInTest = (limiter) => (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  return limiter(req, res, next);
};

const adminMutateGuard = skipInTest(adminMutateLimiter);
const staffActionGuard = skipInTest(staffActionLimiter);

module.exports = { adminMutateGuard, staffActionGuard };