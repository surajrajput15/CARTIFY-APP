const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const StoreSettings = require('../models/StoreSettings');
const { protect, admin, requirePermission } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

// PUBLIC: fetch public store configuration
const getPublicSettings = async (req, res, next) => {
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
};

// ADMIN: fetch full store configuration
const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSettings();
    res.status(200).json({ settings });
  } catch (error) {
    logger.error({ err: error }, 'Admin settings fetch error');
    next(error);
  }
};

// ADMIN: update store settings
const updateAdminSettings = async (req, res, next) => {
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
};

// GET /: If mounted under /admin/settings, serve getAdminSettings; otherwise serve getPublicSettings
router.get('/', (req, res, next) => {
  if (req.baseUrl && req.baseUrl.includes('/admin/settings')) {
    return protect(req, res, () => {
      admin(req, res, () => {
        requirePermission('settings.view')(req, res, () => {
          getAdminSettings(req, res, next);
        });
      });
    });
  }
  return getPublicSettings(req, res, next);
});

// GET /admin: Always serve getAdminSettings (covered by /settings/admin and /admin/settings/admin)
router.get('/admin', protect, admin, requirePermission('settings.view'), getAdminSettings);

// PUT /: Admin update when mounted under /admin/settings
router.put('/', protect, admin, requirePermission('settings.manage'), adminMutateGuard, auditLogMiddleware('UPDATE_SETTINGS', 'StoreSettings'), updateAdminSettings);

// PUT /admin: Admin update when mounted under /settings/admin
router.put('/admin', protect, admin, requirePermission('settings.manage'), adminMutateGuard, auditLogMiddleware('UPDATE_SETTINGS', 'StoreSettings'), updateAdminSettings);

module.exports = router;
