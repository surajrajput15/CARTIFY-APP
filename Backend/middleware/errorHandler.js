const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error({
    err,
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
  }, 'Unhandled server error');

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid data provided' });
  }

  // Duplicate key (e.g. reusing a coupon code) is a conflict, not a bad request.
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate field value' });
  }

  // Malformed ObjectId — the ID format itself is invalid (not "not found").
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
    return res.status(400).json({ message: err.message });
  }

  // express.json() payload exceeded the 10kb body limit — client needs to know it was a
  // size problem (413), not a generic server failure (500).
  if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    return res.status(413).json({ message: 'Request body too large' });
  }

  // CSRF validation failed — missing/invalid/expired token. Must be 403 (not 500)
  // so the frontend axios interceptor can detect it and refresh the token + retry.
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }

  const status = err.statusCode || err.status || 500;
  // 4xx carries the specific reason (e.g. rate-limit "Too many requests");
  // 5xx stays generic so internals never leak to clients.
  if (status >= 500) {
    return res.status(status).json({ message: 'Internal server error' });
  }
  return res.status(status).json({ message: err.message || 'Request failed' });
};

module.exports = errorHandler;
