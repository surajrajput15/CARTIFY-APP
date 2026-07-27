const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');

// 1. CREATE PAYMENT ORDER — SECURE SERVER-SIDE PRICE CALCULATION
router.post('/create-order', protect, async (req, res) => {
    try {
        if (!process.env.RAZORPAY_KEY_ID) {
            console.error("RAZORPAY_KEY_ID is not set in environment");
            return res.status(500).json({ message: "Payment service is not configured (missing key)" });
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("RAZORPAY_KEY_SECRET is not set in environment");
            return res.status(500).json({ message: "Payment service is not configured (missing secret)" });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Items array is required with productId and quantity" });
        }

        for (const item of items) {
            if (!item.productId) {
                return res.status(400).json({ message: "Each item must have a productId" });
            }

            const qty = Number(item.quantity);
            if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
                return res.status(400).json({
                    message: "Each item must have an integer quantity between 1 and 20"
                });
            }
        }

        const productIds = items.map(item => item.productId);

        let products;
        try {
            products = await Product.find({ _id: { $in: productIds } });
        } catch (dbError) {
            console.error("Product.find() failed:", dbError.name, dbError.message);
            if (dbError.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid product ID format in request"
                });
            }
            throw dbError;
        }

        if (products.length !== productIds.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                message: "Some products do not exist",
                missingProductIds: missingIds
            });
        }

        const productMap = {};
        products.forEach(product => {
            productMap[product._id.toString()] = product;
        });

        let calculatedTotal = 0;
        const orderItems = [];
        for (const item of items) {
            const product = productMap[item.productId];

            if (!product.price || product.price <= 0) {
                return res.status(400).json({
                    message: `Product "${product.title}" has an invalid price and cannot be purchased`
                });
            }

            const itemTotal = product.price * item.quantity;
            calculatedTotal += itemTotal;
            orderItems.push({
                productId: product._id,
                title: product.title,
                price: product.price,
                quantity: item.quantity
            });
        }

        const amountInPaise = Math.round(calculatedTotal * 100);
        const receipt = "rcpt_" + crypto.randomBytes(12).toString('hex');

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
        };

        let order;
        try {
            order = await razorpay.orders.create(options);
        } catch (razorpayError) {
            console.error("Razorpay API error:", razorpayError.statusCode, razorpayError.message);
            return res.status(502).json({
                message: "Payment gateway error. Please try again."
            });
        }

        res.status(200).json({
            ...order,
            calculatedAmount: calculatedTotal,
            items: orderItems
        });
    } catch (error) {
        console.error("Payment create-order error:", error.name, error.message);
        res.status(500).json({ message: "Error creating Razorpay order" });
    }
});

// 2. VERIFY PAYMENT SIGNATURE (HMAC-based, already secure)
router.post('/verify-payment', protect, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            return res.status(200).json({ message: "Payment verified successfully", success: true });
        } else {
            return res.status(400).json({ message: "Invalid signature sent!", success: false });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ message: "Error verifying payment" });
    }
});

module.exports = router;
