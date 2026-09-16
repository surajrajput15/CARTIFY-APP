const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');
const { auditLogMiddleware } = require('../middleware/auditLog');

// Order records are built entirely server-side during the payment flow:
//   POST /api/payment/create-order  → persists a Pending order (server-calculated total)
//   POST /api/payment/verify-payment → finalises it to Paid / Processing
// There is no client-facing "create order" endpoint. The client never supplies
// prices, totals, items or payment status, so no duplicate order records can be created.

// GET USER'S ORDERS — capped at 100 for legacy array responses; paginated object
// when ?page/?limit is supplied (backward compatible: old clients get an array).
router.get('/myorders/:userId', protect, async (req, res, next) => {
    try {
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: "You can only view your own orders." });
        }
        const wantsPaging = req.query.page !== undefined || req.query.limit !== undefined;
        if (wantsPaging) {
            const pageNum = Math.max(1, parseInt(req.query.page) || 1);
            const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
            const skip = (pageNum - 1) * limitNum;
            const [orders, total] = await Promise.all([
                Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
                Order.countDocuments({ userId: req.params.userId }),
            ]);
            return res.status(200).json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
        }
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean();
        res.status(200).json(orders);
    } catch (error) {
        // Malformed userId (CastError) is a 400 via the central handler, not a 500.
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Orders fetch error:");
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
// Allowed lifecycle transitions — prevents impossible jumps like Delivered->Pending
// or Pending->Delivered without payment.
const ALLOWED_TRANSITIONS = {
    Pending: ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered', 'Cancelled'],
    Delivered: [],
    Cancelled: [],
};

// GET ALL ORDERS (Admin) — paginated, optional status filter, with customer info
router.get('/admin', protect, admin, async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const query = {};
        if (status && status !== 'all' && ORDER_STATUSES.includes(status)) {
            query.status = status;
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Order.countDocuments(query)
        ]);

        res.status(200).json({
            orders,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Admin orders error:");
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

// UPDATE ORDER STATUS (Admin) — enforced lifecycle transitions + audit.
router.patch('/:id/status', protect, admin, auditLogMiddleware('UPDATE_ORDER_STATUS', 'Order'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
        }

        const existing = await Order.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Order not found" });
        const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
        if (existing.status !== status && !allowed.includes(status)) {
            return res.status(400).json({ message: `Cannot transition from ${existing.status} to ${status}` });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { returnDocument: 'after' }
        );

        if (!order) return res.status(404).json({ message: "Order not found" });

        res.status(200).json({ message: "Order status updated", order });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid order id" });
        }
        logger.error({ err: error }, "Order status update error:");
        res.status(500).json({ message: "Failed to update order status" });
    }
});

module.exports = router;
