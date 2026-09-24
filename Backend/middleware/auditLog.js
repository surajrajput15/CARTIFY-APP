const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

// Middleware to log admin actions
const auditLogMiddleware = (action, resource) => {
  return async (req, res, next) => {
    // Store original response methods to capture response data
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

    // Capture request data
    const userId = req.user?._id;
    const userEmail = req.user?.email;
    const userRole = req.user?.isAdmin ? 'admin' : (req.user?.role || 'user');
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = req.id || req.headers['x-request-id'];

    // For GET requests, we might want to log the query params
    // For mutating requests, capture the request body
    const requestData = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? req.body
      : req.query;

    // Continue to next middleware — do NOT await next() in Express 4 (it is not
    // a promise). Log on response finish so handler-set status/body are captured.
    next();

    res.on('finish', () => {
      logAudit({
        action,
        resource,
        userId,
        userEmail,
        userRole,
        ip,
        userAgent,
        requestId,
        resourceId: req.params.id,
        requestData,
        responseData: responseBody,
        success: statusCode < 400,
        errorMessage: statusCode >= 400 ? responseBody?.message : undefined,
      });
    });
  };
};

// Helper function to create audit log entry
async function logAudit({
  action,
  resource,
  userId,
  userEmail,
  userRole,
  ip,
  userAgent,
  requestId,
  resourceId,
  requestData,
  responseData,
  success,
  errorMessage,
}) {
  try {
    // Sanitize sensitive data (deep — nested objects/arrays included).
    const sanitize = (data, depth = 0) => {
      if (!data || typeof data !== 'object' || depth > 5) return data;
      if (Array.isArray(data)) return data.map((v) => sanitize(v, depth + 1));
      const sensitiveKeys = ['password', 'otp', 'token', 'secret', 'credential', 'authorization'];
      const sanitized = Array.isArray(data) ? [] : { ...data };
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = sanitize(sanitized[key], depth + 1);
        }
      }
      return sanitized;
    };
    if (!userId || !userEmail) return; // AuditLog requires identity — skip anon routes.

    // resourceId is ObjectId-typed: non-ObjectId :id params (e.g. /clear) must not
    // reach the create call or Mongoose throws CastError and kills the audit write.
    const mongoose = require('mongoose');
    const safeResourceId = resourceId && mongoose.Types.ObjectId.isValid(String(resourceId))
      ? resourceId
      : undefined;

    await AuditLog.create({
      userId,
      userEmail,
      userRole,
      action,
      resource,
      resourceId: safeResourceId,
      ip,
      userAgent,
      requestId,
      before: sanitize(requestData),
      after: sanitize(responseData),
      success,
      errorMessage,
    });
  } catch (error) {
    // Don't let audit logging failures affect the main request
    logger.error({ err: error }, 'Audit log error:');
  }
}

module.exports = { auditLogMiddleware, logAudit };