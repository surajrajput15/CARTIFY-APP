const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const DeliveryLocation = require('../models/DeliveryLocation');
const Order = require('../models/Order');
const { protect, delivery } = require('../middleware/auth');

// Simple rate limit for GPS pings: max ~1 ping/5s sustained (12/min) per partner.
// The client throttles to 10s; this guards against a runaway tab.
const MIN_PING_INTERVAL_MS = 5000;
const lastPingByPartner = new Map();

const clampCoord = (val, min, max) => {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

// ---------------------------------------------------------------------------
// DELIVERY PARTNER: push my live position
// POST /api/locations  { orderId, latitude, longitude }
// Allowed ONLY while this partner has that order in an active delivery stage
// (assigned/accepted/picked_up/out_for_delivery). Location history is never
// stored — a single document per partner is upserted and cleaned on delivery end.
router.post('/', protect, delivery, async (req, res, next) => {
  try {
    const { orderId, latitude, longitude } = req.body || {};

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Valid orderId is required' });
    }
    const lat = clampCoord(latitude, -90, 90);
    const lng = clampCoord(longitude, -180, 180);
    if (lat === null || lng === null) {
      return res.status(400).json({ message: 'latitude must be -90..90 and longitude -180..180' });
    }

    // Throttle: reject bursts instead of queueing stale writes.
    const last = lastPingByPartner.get(req.user._id.toString()) || 0;
    const now = Date.now();
    if (now - last < MIN_PING_INTERVAL_MS) {
      return res.status(429).json({ message: 'Location updates too frequent' });
    }

    const order = await Order.findById(orderId).select('deliveryPartnerId deliveryStatus').lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!order.deliveryPartnerId || order.deliveryPartnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this order' });
    }
    if (!['assigned', 'accepted', 'picked_up', 'out_for_delivery'].includes(order.deliveryStatus)) {
      return res.status(400).json({ message: 'Order is not in an active delivery stage' });
    }

    const location = await DeliveryLocation.findOneAndUpdate(
      { deliveryPartnerId: req.user._id },
      {
        $set: {
          orderId: order._id,
          latitude: lat,
          longitude: lng,
          active: true
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    lastPingByPartner.set(req.user._id.toString(), now);

    res.status(200).json({
      latitude: location.latitude,
      longitude: location.longitude,
      updatedAt: location.updatedAt
    });
  } catch (error) {
    logger.error({ err: error }, 'Location update error');
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DELIVERY PARTNER: my own current location doc (for the delivery map UI)
router.get('/courier', protect, delivery, async (req, res, next) => {
  try {
    const loc = await DeliveryLocation.findOne({ deliveryPartnerId: req.user._id }).lean();
    res.status(200).json({
      location: loc ? { latitude: loc.latitude, longitude: loc.longitude, updatedAt: loc.updatedAt, active: loc.active, orderId: loc.orderId } : null
    });
  } catch (error) {
    logger.error({ err: error }, 'Courier location fetch error');
    next(error);
  }
});

// ---------------------------------------------------------------------------
// CUSTOMER / ADMIN: live courier position for a specific order
// GET /api/locations/order/:orderId
//   customer → only their own order AND only while it is being delivered
//   admin    → any order
router.get('/order/:orderId', protect, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
    }

    const order = await Order.findById(orderId)
      .select('userId deliveryPartnerId deliveryStatus status')
      .populate('userId', 'name email')
      .lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = req.user.role === 'admin' || req.user.isAdmin === true;
    const isOwner = order.userId && order.userId._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'You can only track your own orders' });
    }

    // Live location exists only during the delivery window.
    const trackable = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];
    if (!trackable.includes(order.deliveryStatus)) {
      return res.status(200).json({ live: false, deliveryStatus: order.deliveryStatus, location: null });
    }

    const loc = await DeliveryLocation.findOne({ orderId: order._id }).lean();
    res.status(200).json({
      live: Boolean(loc && loc.active),
      deliveryStatus: order.deliveryStatus,
      location: loc ? { latitude: loc.latitude, longitude: loc.longitude, updatedAt: loc.updatedAt } : null
    });
  } catch (error) {
    logger.error({ err: error }, 'Order location fetch error');
    next(error);
  }
});

module.exports = router;