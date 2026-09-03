const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  userRole: { type: String, enum: ['user', 'admin'], required: true },

  // What action was performed
  action: { type: String, required: true }, // e.g., 'CREATE_PRODUCT', 'DELETE_ORDER', 'REFUND_PAYMENT'
  resource: { type: String, required: true }, // e.g., 'Product', 'Order', 'User'
  resourceId: { type: mongoose.Schema.Types.ObjectId },

  // Request metadata
  ip: { type: String },
  userAgent: { type: String },
  requestId: { type: String },

  // Before/after state for data changes
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },

  // Status
  success: { type: Boolean, default: true },
  errorMessage: { type: String },

  // Timestamp
  timestamp: { type: Date, default: Date.now },
}, { timestamps: false });

// Indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });

// TTL index - auto-delete after 1 year (optional, adjust as needed)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);