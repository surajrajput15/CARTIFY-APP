const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const { ownerOnly } = require('../utils/ownerValidator');
const { auditLogMiddleware } = require('../middleware/auditLog');

// ADMIN: GET /api/v1/admin/notifications — list all notifications
router.get('/', protect, admin, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;
        const type = req.query.type;
        const unreadOnly = req.query.unread === 'true';

        const filter = {};
        if (type) filter.type = type;
        if (unreadOnly) filter.read = false;

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .populate('recipient', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter)
        ]);

        res.status(200).json({ notifications, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error({ err: error }, 'Admin notifications list error');
        next(error);
    }
});

// ADMIN: POST /api/v1/admin/notifications — create broadcast or targeted notification
router.post('/', protect, admin, ownerOnly, auditLogMiddleware('CREATE_NOTIFICATION', 'Notification'), async (req, res, next) => {
    try {
        const { title, message, type, recipientId, broadcast } = req.body || {};

        if (!title || !message) {
            return res.status(400).json({ message: 'title and message are required' });
        }

        if (broadcast) {
            const customers = await User.find({ role: 'customer' }).select('_id').lean();
            const notifications = customers.map(u => ({
                recipient: u._id,
                type: type || 'system',
                title,
                message,
                read: false
            }));
            await Notification.insertMany(notifications);
            return res.status(201).json({ message: `Broadcast sent to ${notifications.length} users` });
        }

        if (recipientId) {
            if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                return res.status(400).json({ message: 'Invalid recipientId' });
            }
            const recipient = await User.findById(recipientId);
            if (!recipient) {
                return res.status(404).json({ message: 'Recipient not found' });
            }
        }

        const notification = await Notification.create({
            recipient: recipientId || null,
            type: type || 'system',
            title,
            message,
            read: false
        });

        res.status(201).json({ notification });
    } catch (error) {
        logger.error({ err: error }, 'Create notification error');
        next(error);
    }
});

module.exports = router;