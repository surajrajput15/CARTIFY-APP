const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

// 1. CREATE NEW ORDER
router.post('/create', protect, async (req, res) => {
    try {
        const { orderItems, shippingAddress, totalPrice } = req.body;

        if (orderItems && orderItems.length === 0) {
            return res.status(400).json({ message: "No items in the order" });
        }

        const order = new Order({
            userId: req.user._id,
            orderItems,
            shippingAddress,
            totalPrice
        });

        const savedOrder = await order.save();
        res.status(201).json({ message: "Order placed successfully!", order: savedOrder });
    } catch (error) {
        console.error("❌ Order create error:", error);
        res.status(500).json({ message: "Failed to place order." });
    }
});

// 2. GET USER'S ORDERS
router.get('/myorders/:userId', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: "You can only view your own orders." });
        }
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("❌ Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

// 3. SAVE ORDER AFTER PAYMENT
router.post('/add', protect, async (req, res) => {
    try {
        const newOrder = new Order({ ...req.body, userId: req.user._id });
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        console.error("❌ Order save error:", error);
        res.status(500).json({ message: "Failed to save the final order." });
    }
});

module.exports = router;