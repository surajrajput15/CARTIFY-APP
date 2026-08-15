const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

// Order records are built entirely server-side during the payment flow:
//   POST /api/payment/create-order  → persists a Pending order (server-calculated total)
//   POST /api/payment/verify-payment → finalises it to Paid / Processing
// There is no client-facing "create order" endpoint. The client never supplies
// prices, totals, items or payment status, so no duplicate order records can be created.

// GET USER'S ORDERS
router.get('/myorders/:userId', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: "You can only view your own orders." });
        }
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

// GET ALL ORDERS (Admin) — paginated, optional status filter, with customer info
router.get('/admin', protect, admin, async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const query = {};
        if (status && status !== 'all' && ORDER_STATUSES.includes(status)) {
            query.status = status;
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100);
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
        console.error("Admin orders error:", error);
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

// UPDATE ORDER STATUS (Admin)
router.patch('/:id/status', protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        );

        if (!order) return res.status(404).json({ message: "Order not found" });

        res.status(200).json({ message: "Order status updated", order });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid order id" });
        }
        console.error("Order status update error:", error);
        res.status(500).json({ message: "Failed to update order status" });
    }
});

module.exports = router;
