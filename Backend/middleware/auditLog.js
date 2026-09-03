const AuditLog = require('../models/AuditLog');

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
    const userRole = req.user?.isAdmin ? 'admin' : 'user';
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = req.id || req.headers['x-request-id'];

    // For GET requests, we might want to log the query params
    // For mutating requests, capture the request body
    const requestData = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? req.body
      : req.query;

    // Continue to next middleware
    await next();

    // Log after response is sent
    if (res.writableEnded || res.finished) {
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
    }
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
    // Sanitize sensitive data
    const sanitize = (data) => {
      if (!data || typeof data !== 'object') return data;
      const sensitiveKeys = ['password', 'otp', 'token', 'secret', 'credential', 'authorization'];
      const sanitized = { ...data };
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    };

    await AuditLog.create({
      userId,
      userEmail,
      userRole,
      action,
      resource,
      resourceId,
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
    console.error('Audit log error:', error);
  }
}

module.exports = { auditLogMiddleware, logAudit };