const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const User = require('../models/User');
const Order = require('../models/Order');
const Address = require('../models/Address');
const UserActivity = require('../models/UserActivity');
const { protect, admin } = require('../middleware/auth');
const { isOwnerEmail, applyOwnerRole, ownerOnly } = require('../utils/ownerValidator');
const { auditLogMiddleware } = require('../middleware/auditLog');

const router = express.Router();

// SAFE_SELECT — the ONLY fields ever exposed about a user through the CRM.
// Passwords, OTP hashes, refresh tokens, and previousRefreshToken are NEVER
// included. Even the owner's password hash stays server-side only.
const SAFE_SELECT = {
    name: 1, email: 1, phone: 1, role: 1, isAdmin: 1, status: 1,
    blockReason: 1, blockedAt: 1, deactivatedAt: 1, lastLoginAt: 1,
    assignedWarehouseId: 1, createdAt: 1, updatedAt: 1
};

const SAFE_STATUS = ['active', 'blocked', 'deactivated'];

const parseLimit = (v, d = 20, max = 50) => {
    const n = parseInt(v, 10);
    return Math.min(max, Math.max(1, Number.isFinite(n) ? n : d));
};

// GET /api/v1/admin/users — paginated customer CRM list.
// Query: ?status=all|active|blocked|deactivated &search=q &page=1 &limit=20
// Only customers are listed (staff/warehouse accounts are managed via their own
// portals); the OWNER is listed too (role: admin) so the single-admin can see
// their own row — but the owner can never be blocked (ownerOnly guard below).
router.get('/', protect, admin, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = parseLimit(req.query.limit);
        const skip = (page - 1) * limit;
        const status = SAFE_STATUS.includes(req.query.status) ? req.query.status : null;
        const search = String(req.query.search || '').trim();

        const filter = { role: { $in: ['customer', 'admin'] } };
        if (status) filter.status = status;
        if (search) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
        }

        const [users, total] = await Promise.all([
            User.find(filter).select(SAFE_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter)
        ]);

        res.status(200).json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit),
            counts: await User.aggregate([
                { $match: { role: { $in: ['customer', 'admin'] } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        });
    } catch (error) {
        logger.error({ err: error }, 'Admin users CRM list error');
        next(error);
    }
});

// GET /api/v1/admin/users/:id — single user CRM detail.
// Includes: profile, order stats, addresses, last login, login history.
// Passwords / OTP / refresh tokens are never returned (SAFE_SELECT + no
// password field on the login-history query).
router.get('/:id', protect, admin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        const user = await User.findById(id).select(SAFE_SELECT).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [orderStats, addresses, loginEvents] = await Promise.all([
            Order.aggregate([
                { $match: { userId: user._id } },
                {
                    $group: {
                        _id: null,
                        orderCount: { $sum: 1 },
                        totalSpent: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalPrice', 0] }
                        }
                    }
                }
            ]),
            Address.find({ userId: user._id }).select('fullName phone street city state pincode isDefault').sort({ isDefault: -1 }).limit(10).lean(),
            UserActivity.find({ userId: user._id, event: 'AUTH_LOGIN' })
                .sort({ timestamp: -1 })
                .limit(10)
                .select('timestamp details ip userAgent')
                .lean()
        ]);

        res.status(200).json({
            user,
            orderStats: orderStats[0] || { orderCount: 0, totalSpent: 0 },
            addresses,
            loginHistory: loginEvents
        });
    } catch (error) {
        logger.error({ err: error }, 'Admin user CRM detail error');
        next(error);
    }
});

// PATCH /api/v1/admin/users/:id/status — block / unblock / deactivate / activate.
// OWNER-ONLY: only the owner emailmay change customer status. The owner can
// NEVER be targeted (isOwnerEmail guard), and the requestor can never target
// themselves (`req.user._id === id` guard).
router.patch('/:id/status', protect, admin, ownerOnly, auditLogMiddleware('UPDATE_USER_STATUS', 'User'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        if (!['block', 'unblock', 'deactivate', 'activate'].includes(action)) {
            return res.status(400).json({ message: 'action must be block|unblock|deactivate|activate' });
        }
        if (req.user._id.toString() === id.toString()) {
            return res.status(400).json({ message: 'You cannot change your own status' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (isOwnerEmail(user.email)) {
            return res.status(400).json({ message: 'The owner account cannot be blocked or deactivated' });
        }

        const patch = {};
        if (action === 'block')        { patch.status = 'blocked';      patch.blockedAt = new Date(); patch.blockReason = req.body?.reason || null; }
        if (action === 'unblock')      { patch.status = 'active';       patch.blockedAt = null;       patch.blockReason = null; }
        if (action === 'deactivate')   { patch.status = 'deactivated';  patch.deactivatedAt = new Date(); }
        if (action === 'activate')     { patch.status = 'active';       patch.deactivatedAt = null; }

        await applyOwnerRole(user);
        Object.assign(user, patch);
        await user.save();

        res.status(200).json({
            message: `User ${action}ed successfully`,
            user: (await User.findById(id).select(SAFE_SELECT).lean())
        });
    } catch (error) {
        logger.error({ err: error }, 'Admin user status update error');
        next(error);
    }
});

// GET /api/v1/admin/users/:id/login-history — full AUTH_LOGIN history (paginated)
router.get('/:id/login-history', protect, admin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = parseLimit(req.query.limit, 20);
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const [events, total] = await Promise.all([
            UserActivity.find({ userId: id, event: 'AUTH_LOGIN' })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .select('timestamp details ip userAgent')
                .lean(),
            UserActivity.countDocuments({ userId: id, event: 'AUTH_LOGIN' })
        ]);

        res.status(200).json({ events, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error({ err: error }, 'Admin login-history error');
        next(error);
    }
});

module.exports = router;
