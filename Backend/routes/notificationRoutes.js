const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// USER: GET /api/v1/notifications/mine — user's notifications
router.get('/mine', protect, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        const filter = { recipient: req.user._id };
        if (unreadOnly) filter.read = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments({ recipient: req.user._id, read: false })
        ]);

        res.status(200).json({ notifications, total, page, pages: Math.ceil(total / limit), unreadCount });
    } catch (error) {
        logger.error({ err: error }, 'Fetch my notifications error');
        next(error);
    }
});

// USER: PATCH /api/v1/notifications/:id/read — mark as read
router.patch('/:id/read', protect, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid notification ID' });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.user._id },
            { $set: { read: true, readAt: new Date() } },
            { returnDocument: 'after' }
        ).lean();

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({ notification });
    } catch (error) {
        logger.error({ err: error }, 'Mark notification read error');
        next(error);
    }
});

module.exports = router;