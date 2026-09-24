const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, admin } = require('../middleware/auth');

// ADMIN: query audit history.
//    GET /?user=q&action=X&resource=Y&success=true&from=ISO&to=ISO&page=1&limit=20
// `user` matches userEmail (case-insensitive substring) or an exact userId/objectId.
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.resource) filter.resource = String(req.query.resource);
    if (req.query.success === 'true') filter.success = true;
    if (req.query.success === 'false') filter.success = false;

    if (req.query.user) {
      const q = String(req.query.user).trim();
      if (mongoose.Types.ObjectId.isValid(q)) {
        filter.userId = new mongoose.Types.ObjectId(q);
      } else {
        filter.userEmail = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      }
    }

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
      return res.status(400).json({ message: 'from/to must be valid ISO dates' });
    }
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = from;
      if (to) filter.timestamp.$lte = to;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit log query error');
    next(error);
  }
});

// ADMIN: distinct filter values for the audit UI dropdowns.
router.get('/meta', protect, admin, async (req, res, next) => {
  try {
    const [actions, resources, roles] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('resource'),
      AuditLog.distinct('userRole'),
    ]);
    res.status(200).json({
      actions: actions.sort(),
      resources: resources.sort(),
      roles: roles.sort(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit meta error');
    next(error);
  }
});

module.exports = router;
