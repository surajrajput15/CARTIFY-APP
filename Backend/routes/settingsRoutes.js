const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const StoreSettings = require('../models/StoreSettings');
const { protect, admin, requirePermission } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

// PUBLIC: GET /api/v1/settings — public store configuration
router.get('/', async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSettings();
    res.status(200).json({
      storeName: settings.storeName,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      shippingFee: settings.shippingFee,
      freeShippingThreshold: settings.freeShippingThreshold
    });
  } catch (error) {
    logger.error({ err: error }, 'Public settings fetch error');
    next(error);
  }
});

// ADMIN: GET /api/v1/settings/admin — all store configurations
router.get('/admin', protect, admin, requirePermission('settings.view'), async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSettings();
    res.status(200).json({ settings });
  } catch (error) {
    logger.error({ err: error }, 'Admin settings fetch error');
    next(error);
  }
});

// ADMIN: PUT /api/v1/settings/admin — update store settings
router.put('/admin', protect, admin, requirePermission('settings.manage'), adminMutateGuard, auditLogMiddleware('UPDATE_SETTINGS', 'StoreSettings'), async (req, res, next) => {
  try {
    const allowed = [
      'storeName', 'supportEmail', 'supportPhone', 'currency', 'currencySymbol',
      'shippingFee', 'freeShippingThreshold', 'defaultLowStockThreshold',
      'orderAutoCancelMinutes', 'systemNotificationsEnabled', 'emailNotificationsEnabled'
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (['shippingFee', 'freeShippingThreshold', 'defaultLowStockThreshold', 'orderAutoCancelMinutes'].includes(key)) {
          const num = Number(req.body[key]);
          if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({ message: `${key} must be a non-negative number` });
          }
          updates[key] = num;
        } else if (typeof req.body[key] === 'boolean') {
          updates[key] = req.body[key];
        } else if (typeof req.body[key] === 'string') {
          updates[key] = req.body[key].trim();
        }
      }
    }

    let settings = await StoreSettings.findOne({});
    if (!settings) {
      settings = new StoreSettings(updates);
    } else {
      Object.assign(settings, updates);
    }
    await settings.save();

    res.status(200).json({
      message: 'Store settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error({ err: error }, 'Admin settings update error');
    next(error);
  }
});

module.exports = router;
