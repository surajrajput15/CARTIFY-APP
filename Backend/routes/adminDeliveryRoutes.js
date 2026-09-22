const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

// GET /api/v1/admin/delivery-partners
// Admin only — list delivery partners (role: 'delivery') with their current
// live-order count so the assign UI can show workload.
router.get('/delivery-partners', protect, admin, async (req, res, next) => {
  try {
    const [partners, liveCounts] = await Promise.all([
      User.find({ role: 'delivery' })
        .select('-password -refreshToken -refreshTokenExpire -previousRefreshToken -previousRefreshTokenExpire -otp -otpExpire -otpAttempts')
        .sort({ createdAt: -1 })
        .lean(),
      Order.aggregate([
        { $match: { deliveryStatus: { $in: ACTIVE_DELIVERY_STATUSES } } },
        { $group: { _id: '$deliveryPartnerId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(liveCounts.map((c) => [String(c._id), c.count]));

    res.status(200).json({
      partners: partners.map((p) => ({
        ...p,
        activeDeliveries: countMap.get(String(p._id)) || 0,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'List delivery partners error:');
    res.status(500).json({ message: 'Failed to list delivery partners' });
  }
});

module.exports = router;