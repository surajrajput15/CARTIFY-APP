const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');

// 1. CREATE PAYMENT ORDER
router.post('/create-order', protect, async (req, res) => {
    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Razorpay hamesha paise (paisa) mein amount leta hai, isliye * 100
        const options = {
            amount: req.body.amount * 100, 
            currency: "INR",
            receipt: "receipt_order_" + Math.random().toString(36).substring(7),
        };
        
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ message: "Error creating Razorpay order" });
    }
});

// 2. VERIFY PAYMENT SIGNATURE
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
        console.error("❌ Payment verification error:", error);
        res.status(500).json({ message: "Error verifying payment" });
    }
});

module.exports = router;