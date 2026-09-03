const pino = require('pino');

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.cookies.*',
      'req.body.password',
      'req.body.otp',
      'req.body.newPassword',
      'req.body.credential',
      'req.body.token',
      'req.body.refreshToken',
      '*.password',
      '*.otp',
      '*.token',
      '*.secret',
      '*.authorization',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'cartify-api',
    environment: process.env.NODE_ENV || 'development',
  },
});

// Child logger for specific contexts
const createChildLogger = (context) => {
  return logger.child({ context });
};

module.exports = { logger, createChildLogger };