const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { logger } = require('../utils/logger');
const router = express.Router();
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const { protect, admin } = require('../middleware/auth');
const { isOwnerEmail } = require('../utils/ownerValidator');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard } = require('../utils/routeLimiters');

// Staff management (B11): admins create/promote the operational roles the portal
// pages gate on — delivery partners and warehouse staff. A normal customer signs
// up via /auth/register (customer-only), so this is the ONLY way a non-customer
// role legitimately appears in the system.

const STAFF_ROLES = ['delivery', 'warehouse'];
const SAFE_SELECT = 'name email phone role isAdmin assignedWarehouseId createdAt';

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

// GET /admin/staff?role=delivery|warehouse|all — list all staff accounts.
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const filter = { role: { $in: STAFF_ROLES } };
    if (req.query.role && STAFF_ROLES.includes(req.query.role)) {
      filter.role = req.query.role;
    }
    const staff = await User.find(filter)
      .select(SAFE_SELECT)
      .populate('assignedWarehouseId', 'name code city state')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ staff });
  } catch (error) {
    logger.error({ err: error }, 'Staff list error');
    next(error);
  }
});

// POST /admin/staff — create a new staff account (delivery or warehouse).
//   { name, email, password, role, phone?, warehouseId? (warehouse role) }
router.post('/', protect, admin, adminMutateGuard, auditLogMiddleware('CREATE_STAFF', 'User'), async (req, res, next) => {
  try {
    const { name, email, password, role, phone, warehouseId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }
    if (!role || !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'role must be delivery or warehouse' });
    }
    if (role === 'warehouse' && !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.status(400).json({ message: 'warehouseId is required for warehouse staff' });
    }
    if (role === 'warehouse') {
      const wh = await Warehouse.findById(warehouseId);
      if (!wh) return res.status(404).json({ message: 'Warehouse not found' });
    }
    if (phone != null && typeof phone !== 'string') {
      return res.status(400).json({ message: 'Invalid phone format' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: String(email).trim().toLowerCase(),
      password: hashed,
      role,
      phone: phone || null,
      assignedWarehouseId: role === 'warehouse' ? warehouseId : null,
    });

    res.status(201).json({
      user: {
        _id: user._id, name: user.name, email: user.email,
        role: user.role, phone: user.phone, assignedWarehouseId: user.assignedWarehouseId,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }
    logger.error({ err: error }, 'Staff create error');
    next(error);
  }
});

// PATCH /admin/staff/:id — update role and/or warehouse assignment.
//   { role?, warehouseId? }
router.patch('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('UPDATE_STAFF', 'User'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const set = {};
    if (req.body.role !== undefined) {
      if (!STAFF_ROLES.includes(req.body.role) && req.body.role !== 'customer') {
        return res.status(400).json({ message: 'Invalid role' });
      }
      set.role = req.body.role;
      if (req.body.role !== 'warehouse') set.assignedWarehouseId = null;
    }
    if (req.body.warehouseId !== undefined) {
      if (req.body.warehouseId === null || req.body.warehouseId === '') {
        set.assignedWarehouseId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(req.body.warehouseId)) {
          return res.status(400).json({ message: 'Invalid warehouse ID' });
        }
        const wh = await Warehouse.findById(req.body.warehouseId);
        if (!wh) return res.status(404).json({ message: 'Warehouse not found' });
        set.assignedWarehouseId = req.body.warehouseId;
      }
    }

    const updated = await User.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' })
      .select(SAFE_SELECT)
      .populate('assignedWarehouseId', 'name code city state')
      .lean();
    res.status(200).json({ user: updated });
  } catch (error) {
    logger.error({ err: error }, 'Staff update error');
    next(error);
  }
});

// DELETE /admin/staff/:id — demote to customer (never hard-delete an account
// with history; keeps orders/activity referencable).
router.delete('/:id', protect, admin, adminMutateGuard, auditLogMiddleware('DELETE_STAFF', 'User'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndUpdate(id, { $set: { role: 'customer', assignedWarehouseId: null } });
    res.status(200).json({ message: 'Staff account demoted to customer' });
  } catch (error) {
    logger.error({ err: error }, 'Staff delete error');
    next(error);
  }
});

module.exports = router;