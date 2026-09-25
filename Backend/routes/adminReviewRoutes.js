const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');
const { ownerOnly } = require('../utils/ownerValidator');
const { auditLogMiddleware } = require('../middleware/auditLog');

// ADMIN: GET /api/v1/admin/reviews — moderation list with status filter
router.get('/', protect, admin, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;
        const status = ['pending', 'approved', 'hidden'].includes(req.query.status) ? req.query.status : null;
        const search = String(req.query.search || '').trim();

        const filter = {};
        if (status) filter.status = status;
        if (search) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ userName: rx }, { title: rx }, { comment: rx }];
        }

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate('product', 'title')
                .populate('user', 'name email')
                .select('product user userName rating title comment status verified createdAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(filter)
        ]);

        res.status(200).json({ reviews, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error({ err: error }, 'Admin reviews list error');
        next(error);
    }
});

// ADMIN: PATCH /api/v1/admin/reviews/:id/status — approve/hide
router.patch('/:id/status', protect, admin, ownerOnly, auditLogMiddleware('MODERATE_REVIEW', 'Review'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid review ID' });
        }
        if (!['approve', 'hide'].includes(status)) {
            return res.status(400).json({ message: 'status must be approve or hide' });
        }

        const review = await Review.findByIdAndUpdate(
            id,
            { $set: { status: status === 'approve' ? 'approved' : 'hidden' } },
            { returnDocument: 'after' }
        ).lean();

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.status(200).json({ message: `Review ${status}d successfully`, review });
    } catch (error) {
        logger.error({ err: error }, 'Admin moderate review error');
        next(error);
    }
});

module.exports = router;