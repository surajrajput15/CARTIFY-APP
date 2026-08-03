const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

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

module.exports = router;
