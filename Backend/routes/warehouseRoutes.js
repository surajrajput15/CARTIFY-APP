const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

// Filled in lazily (require once here avoids a circular Scuba dive — InventoryItem
// is needed only on deactivate/delete; import at top would also be fine but this
// keeps the module load order explicit).
const getInventoryModel = () => require('../models/InventoryItem');

const sanitizeBody = (body) => {
  const out = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return { error: 'name must be 1-80 characters' };
    out.name = name;
  }
  if (body.code !== undefined) {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{1,10}$/.test(code)) return { error: 'code must be 1-10 letters or digits (A-Z, 0-9)' };
    out.code = code;
  }
  if (body.city !== undefined) {
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    if (!city || city.length > 60) return { error: 'city must be 1-60 characters' };
    out.city = city;
  }
  if (body.state !== undefined) {
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    if (!state || state.length > 60) return { error: 'state must be 1-60 characters' };
    out.state = state;
  }
  if (body.addressLine !== undefined) {
    const v = typeof body.addressLine === 'string' ? body.addressLine.trim() : '';
    if (v.length > 300) return { error: 'addressLine must be at most 300 characters' };
    out.addressLine = v;
  }
  if (body.managerName !== undefined) {
    const v = typeof body.managerName === 'string' ? body.managerName.trim() : '';
    if (v.length > 80) return { error: 'managerName must be at most 80 characters' };
    out.managerName = v;
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return { out };
};

// ADMIN: list all warehouses with aggregate stock counts.
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const [warehouses, counts] = await Promise.all([
      Warehouse.find({}).sort({ isActive: -1, name: 1 }).lean(),
      getInventoryModel().aggregate([
        { $group: { _id: '$warehouseId', skus: { $sum: 1 }, units: { $sum: '$quantity' } } }
      ]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));

    res.status(200).json({
      warehouses: warehouses.map((w) => ({
        ...w,
        skuCount: countMap.get(String(w._id))?.skus || 0,
        totalUnits: countMap.get(String(w._id))?.units || 0,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse list error');
    next(error);
  }
});

// ADMIN: create warehouse
router.post('/', protect, admin, adminMutateGuard, auditLogMiddleware('CREATE_WAREHOUSE', 'Warehouse'), async (req, res, next) => {
  try {
    const { error, out } = sanitizeBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (!out.name || !out.code || !out.city || !out.state) {
      return res.status(400).json({ message: 'name, code, city and state are required' });
    }
    const warehouse = await Warehouse.create(out);
    res.status(201).json(warehouse);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({ message: `A warehouse with this ${field === 'code' ? 'code' : 'name'} already exists` });
    }
    logger.error({ err: error }, 'Warehouse create error');
    next(error);
  }
});

// ADMIN: update warehouse
router.patch('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_WAREHOUSE', 'Warehouse'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid warehouse ID format' });
    }
    const { error, out } = sanitizeBody(req.body);
    if (error) return res.status(400).json({ message: error });
    if (Object.keys(out).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    const updated = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { $set: out },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Warehouse not found' });
    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({ message: `A warehouse with this ${field === 'code' ? 'code' : 'name'} already exists` });
    }
    logger.error({ err: error }, 'Warehouse update error');
    next(error);
  }
});

// ADMIN: delete warehouse — refuses if stock still exists in it so a product's
// stock can never silently vanish when its warehouse row is removed.
router.delete('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_WAREHOUSE', 'Warehouse'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid warehouse ID format' });
    }
    const stock = await getInventoryModel().countDocuments({ warehouseId: req.params.id });
    if (stock > 0) {
      return res.status(409).json({ message: `Cannot delete: ${stock} inventory record(s) exist here. Zero them out first.` });
    }
    const deleted = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Warehouse not found' });
    res.status(200).json({ message: 'Warehouse deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Warehouse delete error');
    next(error);
  }
});

module.exports = router;