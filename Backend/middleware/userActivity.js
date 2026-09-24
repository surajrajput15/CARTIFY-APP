const UserActivity = require('../models/UserActivity');
const { logger } = require('../utils/logger');

// User-behaviour tracking (B4). Same fire-and-forget philosophy as the audit
// middleware: activity must never break or slow a user request. Every write is
// wrapped in try/catch and never awaited by the request path.

const SENSITIVE_KEYS = ['password', 'otp', 'token', 'secret', 'credential', 'authorization', 'signature'];

const sanitizeDetails = (data, depth = 0) => {
  if (!data || typeof data !== 'object' || depth > 4) return data;
  if (Array.isArray(data)) return data.slice(0, 20).map((v) => sanitizeDetails(v, depth + 1));
  const out = {};
  for (const key of Object.keys(data).slice(0, 30)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizeDetails(data[key], depth + 1);
    }
  }
  return out;
};

const requestMeta = (req) => ({
  ip: req.ip || req.headers['x-forwarded-for'] || null,
  userAgent: req.headers['user-agent'] || null,
});

// Direct call for flows where identity isn't on req.user yet (login, register,
// OTP verify, Google) or where the event is dynamic (checkout verify outcome).
// Safe to call without await — failures are contained and logged.
function logActivity({ userId, userEmail = null, event, details = null, req = null }) {
  if (!userId || !event) return;
  const meta = req ? requestMeta(req) : { ip: null, userAgent: null };
  UserActivity.create({
    userId,
    userEmail,
    event,
    details: sanitizeDetails(details),
    ip: meta.ip,
    userAgent: meta.userAgent,
  }).catch((error) => {
    logger.error({ err: error }, 'User activity log error:');
  });
}

// Middleware for authenticated routes: logs `event` on response finish.
// - Skips silently when there's no identity (public routes with softProtect).
// - `detailFn(req, responseBody)` builds the small details object.
// - `skipWhen(req)` suppresses noisy reads (e.g. unfiltered product lists).
// - Only successful responses (status < 400) are logged — failures aren't behaviour.
const activityLogger = (event, detailFn = null, options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    const originalStatus = res.status;
    let responseBody = null;
    let statusCode = 200;

    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };
    res.status = function (code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    const userId = req.user?._id;
    const userEmail = req.user?.email || null;
    const meta = requestMeta(req);

    // Do NOT await next() in Express 4 — log on finish like the audit middleware.
    next();

    res.on('finish', () => {
      try {
        if (!userId) return;
        if (statusCode >= 400) return;
        if (options.skipWhen && options.skipWhen(req)) return;
        const details = typeof detailFn === 'function' ? detailFn(req, responseBody) : null;
        UserActivity.create({
          userId,
          userEmail,
          event,
          details: sanitizeDetails(details),
          ip: meta.ip,
          userAgent: meta.userAgent,
        }).catch((error) => {
          logger.error({ err: error }, 'User activity log error:');
        });
      } catch (error) {
        logger.error({ err: error }, 'User activity log error:');
      }
    });
  };
};

// Checkout verify has two meaningful outcomes in one endpoint: inspect the
// captured response body (the route always returns { success: bool, order? }).
const checkoutActivityLogger = () => {
  return (req, res, next) => {
    const originalJson = res.json;
    const originalStatus = res.status;
    let responseBody = null;
    let statusCode = 200;

    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };
    res.status = function (code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    const userId = req.user?._id;
    const userEmail = req.user?.email || null;
    const meta = requestMeta(req);

    next();

    res.on('finish', () => {
      try {
        if (!userId) return;
        const ok = statusCode < 400 && responseBody && responseBody.success === true;
        const order = responseBody && responseBody.order;
        UserActivity.create({
          userId,
          userEmail,
          event: ok ? 'CHECKOUT_COMPLETE' : 'CHECKOUT_FAILED',
          details: sanitizeDetails({
            orderId: order && (order._id || order.id),
            total: order && order.totalPrice,
          }),
          ip: meta.ip,
          userAgent: meta.userAgent,
        }).catch((error) => {
          logger.error({ err: error }, 'User activity log error:');
        });
      } catch (error) {
        logger.error({ err: error }, 'User activity log error:');
      }
    });
  };
};

module.exports = { logActivity, activityLogger, checkoutActivityLogger };
