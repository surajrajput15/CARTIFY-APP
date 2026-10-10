const mongoose = require('mongoose');

const monitoringLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'INFO',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    channel: {
      type: String,
      default: 'TELEGRAM',
    },
    deliveryStatus: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'THROTTLED', 'DISABLED', 'NO_CHAT_ID'],
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
      default: null,
    },
    telegramMessageId: {
      type: Number,
      default: null,
    },
    correlationId: {
      type: String,
      default: null,
    },
  },
  { timestamps: false }
);

// Indexes
monitoringLogSchema.index({ eventType: 1, timestamp: -1 });
monitoringLogSchema.index({ severity: 1, timestamp: -1 });
monitoringLogSchema.index({ deliveryStatus: 1, timestamp: -1 });

// TTL index: 90 days retention to keep database lean
monitoringLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('MonitoringLog', monitoringLogSchema);
