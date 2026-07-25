const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');

// 1. CREATE PAYMENT ORDER — SECURE SERVER-SIDE PRICE CALCULATION
router.post('/create-order', protect, async (req, res) => {
    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Step 1: Accept only product IDs and quantities — NEVER the amount
        const { items } = req.body; // [{ productId: "...", quantity: 2 }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Items array is required with productId and quantity" });
        }

        // Step 2: Strict validation for every item
        for (const item of items) {
            // productId is mandatory
            if (!item.productId) {
                return res.status(400).json({ message: "Each item must have a productId" });
            }

            // Quantity must be a whole number (integer), between 1 and 20
            // Number.isInteger rejects decimal numbers (e.g. 1.5), strings (e.g. "2"), booleans, etc.
            // This prevents fractional-item or string-injection attacks
            if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
                return res.status(400).json({
                    message: "Each item must have an integer quantity between 1 and 20"
                });
            }
        }

        // Step 3: Fetch all products from MongoDB by their IDs (single query)
        const productIds = items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } });

        // Step 4: Ensure every requested product actually exists in the database
        if (products.length !== productIds.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                message: "Some products do not exist",
                missingProductIds: missingIds
            });
        }

        // Step 5: Build a lookup map for O(1) access
        const productMap = {};
        products.forEach(product => {
            productMap[product._id.toString()] = product;
        });

        // Step 6: Validate prices and calculate total server-side
        let calculatedTotal = 0;
        const orderItems = [];
        for (const item of items) {
            const product = productMap[item.productId];

            // Guard against corrupted DB data — a product with no price or zero/negative price
            // should never be sold. If this fires, it indicates a data integrity issue.
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

        // Step 7: Razorpay accepts amount in paise (1 INR = 100 paise)
        const amountInPaise = Math.round(calculatedTotal * 100);

        // Step 8: Generate a cryptographically strong receipt ID
        // Math.random() is predictable and should never be used for identifiers or security contexts.
        // crypto.randomUUID() (Node >= 19) / crypto.randomBytes() are CSPRNG-backed.
        const receipt = "receipt_" + (
            typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : crypto.randomBytes(16).toString('hex')
        );

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
        };

        // Step 9: Create Razorpay order with only the server-calculated amount
        const order = await razorpay.orders.create(options);

        // Step 10: Return order details + calculated amount + item breakdown
        res.status(200).json({
            ...order,
            calculatedAmount: calculatedTotal,
            items: orderItems
        });
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ message: "Error creating Razorpay order" });
    }
});

// 2. VERIFY PAYMENT SIGNATURE (unchanged — HMAC-based, already secure)
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
