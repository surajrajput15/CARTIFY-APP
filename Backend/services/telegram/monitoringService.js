/**
 * Central Monitoring Service
 * Orchestrates event logging, data sanitization, alert throttling,
 * persistent MongoDB auditing, and Telegram delivery.
 * 
 * DESIGN PRINCIPLE: Completely non-blocking and resilient.
 * Core user flows (checkout, payment, auth) MUST NEVER fail or slow down due to monitoring.
 */

const crypto = require('crypto');
const { logger } = require('../../utils/logger');
const { sanitizePayload } = require('./sanitizer');
const { alertThrottler } = require('./alertThrottler');
const { formatAlertMessage } = require('./messageFormatter');
const { telegramClient } = require('./telegramClient');
const MonitoringLog = require('../../models/MonitoringLog');

const EVENT_SEVERITIES = {
  // CRITICAL (Immediate high-priority alert)
  SECURITY_INVALID_WEBHOOK_SIGNATURE: 'CRITICAL',
  DB_DISCONNECTED: 'CRITICAL',
  SYSTEM_ERROR: 'CRITICAL',
  ORDER_STOCK_SHORTFALL: 'CRITICAL',
  AUTH_LOCKOUT: 'CRITICAL',

  // HIGH (Important financial / security state)
  PAYMENT_VERIFIED_SUCCESS: 'HIGH',
  PAYMENT_WEBHOOK_CAPTURED: 'HIGH',
  REFUND_PROCESSED: 'HIGH',
  REFUND_FAILED: 'HIGH',
  PAYMENT_VERIFY_FAILED: 'HIGH',
  PAYMENT_WEBHOOK_MISMATCH: 'HIGH',
  SECURITY_UNAUTHORIZED_ADMIN: 'HIGH',
  SECURITY_CSRF_VIOLATION: 'HIGH',

  // MEDIUM (Business state changes / warning)
  ORDER_CREATED: 'MEDIUM',
  ORDER_PAID: 'MEDIUM',
  ORDER_CANCELLED: 'MEDIUM',
  INVENTORY_LOW_STOCK: 'MEDIUM',
  AUTH_LOGIN_FAILED: 'MEDIUM',
  AUTH_GOOGLE_FAILED: 'MEDIUM',
  SECURITY_RATE_LIMIT_HIT: 'MEDIUM',

  // LOW / INFO (Normal operational activity)
  AUTH_REGISTER: 'LOW',
  AUTH_LOGIN_SUCCESS: 'INFO',
  AUTH_GOOGLE_SUCCESS: 'INFO',
  AUTH_LOGOUT: 'INFO',
  ORDER_STATUS_CHANGED: 'LOW',
  DELIVERY_UPDATE: 'LOW',
  PRODUCT_MUTATION: 'LOW',
  STOCK_ADJUSTED: 'LOW',
  PAYMENT_INITIATED: 'INFO',
  DB_RECONNECTED: 'INFO',
};

/**
 * Build a throttle key from event type and payload identifiers
 */
function buildThrottleKey(eventType, payload) {
  const p = payload || {};
  switch (eventType) {
    case 'AUTH_LOGIN_FAILED':
    case 'AUTH_LOCKOUT':
      return `${eventType}:${p.email || p.ip || 'global'}`;
    case 'SECURITY_RATE_LIMIT_HIT':
    case 'SECURITY_UNAUTHORIZED_ADMIN':
    case 'SECURITY_CSRF_VIOLATION':
      return `${eventType}:${p.ip || 'global'}`;
    case 'INVENTORY_LOW_STOCK':
      return `${eventType}:${p.productId || p.title || 'global'}`;
    case 'SYSTEM_ERROR':
      return `${eventType}:${p.message || 'error'}`;
    case 'DB_DISCONNECTED':
      return `${eventType}:mongodb`;
    default:
      return null; // Do not throttle transaction events (orders, payments, refunds)
  }
}

/**
 * Dispatch an event to the monitoring system.
 * Non-blocking: scheduled via setImmediate so HTTP handlers return without waiting.
 * 
 * @param {string} eventType Name of the business/security/system event
 * @param {object} rawPayload Event data (will be deeply sanitized)
 * @param {object} options Optional flags ({ correlationId, req, sync })
 */
function notifyMonitoring(eventType, rawPayload = {}, options = {}) {
  const eventId = crypto.randomUUID();
  const timestamp = new Date();
  const severity = EVENT_SEVERITIES[eventType] || 'INFO';
  const correlationId = options.correlationId || options.req?.id || null;

  // Asynchronous worker function
  const executeDispatch = async () => {
    try {
      // 1. Sanitize payload thoroughly
      const sanitized = sanitizePayload(rawPayload);

      // 2. Check alert throttling
      const throttleKey = buildThrottleKey(eventType, rawPayload);
      const { shouldSend, suppressedCount } = alertThrottler.shouldAlert(eventType, throttleKey);

      let deliveryStatus = 'DELIVERED';
      let errorMessage = null;
      let telegramMessageId = null;

      if (!shouldSend) {
        deliveryStatus = 'THROTTLED';
      } else {
        // 3. Format message
        const messageText = formatAlertMessage(eventType, { ...sanitized, timestamp }, { suppressedCount });

        // 4. Send via Telegram client
        const sendResult = await telegramClient.sendMessage(messageText);

        if (!sendResult.success) {
          if (sendResult.skipped) {
            deliveryStatus = sendResult.reason === 'CHAT_ID_NOT_CONFIGURED' ? 'NO_CHAT_ID' : 'DISABLED';
          } else {
            deliveryStatus = 'FAILED';
            errorMessage = sendResult.error || 'Unknown delivery failure';
          }
        } else {
          telegramMessageId = sendResult.messageId || null;
        }
      }

      // 5. Persist audit log entry to MongoDB
      // Only attempt write if mongoose is connected
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        await MonitoringLog.create({
          eventId,
          eventType,
          severity,
          timestamp,
          channel: 'TELEGRAM',
          deliveryStatus,
          metadata: sanitized,
          errorMessage,
          telegramMessageId,
          correlationId,
        }).catch((dbErr) => {
          logger.error({ err: dbErr, eventId }, 'Failed to persist MonitoringLog');
        });
      }
    } catch (err) {
      // Ensure exceptions never bubble up to callers
      logger.error({ err, eventType, eventId }, 'Error inside notifyMonitoring dispatch');
    }
  };

  if (options.sync === true) {
    // Return the promise directly if caller explicitly asked for sync (e.g. in test suites)
    return executeDispatch();
  }

  // Normal path: Non-blocking execution
  setImmediate(executeDispatch);
  return Promise.resolve({ queued: true, eventId });
}

module.exports = {
  notifyMonitoring,
  EVENT_SEVERITIES,
  buildThrottleKey,
};
