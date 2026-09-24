const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const UserActivity = require('../models/UserActivity');
const { protect, admin } = require('../middleware/auth');

// ADMIN: query the user-behaviour timeline.
//    GET /?user=q&event=X&from=ISO&to=ISO&page=1&limit=20
// `user` matches userEmail (case-insensitive substring) or an exact userId.
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.event) filter.event = String(req.query.event);

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

    const [total, events] = await Promise.all([
      UserActivity.countDocuments(filter),
      UserActivity.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
    ]);

    res.status(200).json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      events,
    });
  } catch (error) {
    logger.error({ err: error }, 'User activity query error');
    next(error);
  }
});

// ADMIN: distinct events for the activity UI filter dropdown.
router.get('/meta', protect, admin, async (req, res, next) => {
  try {
    const events = await UserActivity.distinct('event');
    res.status(200).json({ events: events.sort() });
  } catch (error) {
    logger.error({ err: error }, 'User activity meta error');
    next(error);
  }
});

module.exports = router;
