const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');

// 1. CREATE PAYMENT ORDER — SECURE SERVER-SIDE PRICE CALCULATION
router.post('/create-order', protect, async (req, res) => {
    try {
        // ===== ENVIRONMENT CHECK =====
        // If env vars are missing, Razorpay SDK doesn't fail at init — it fails at order creation
        // with a cryptic error. Check upfront so the response is meaningful.
        if (!process.env.RAZORPAY_KEY_ID) {
            console.error("PAYMENT DEBUG: RAZORPAY_KEY_ID is not set in environment");
            return res.status(500).json({ message: "Payment service is not configured (missing key)" });
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("PAYMENT DEBUG: RAZORPAY_KEY_SECRET is not set in environment");
            return res.status(500).json({ message: "Payment service is not configured (missing secret)" });
        }

        console.log("===== PAYMENT CREATE-ORDER =====");
        console.log("Incoming body:", JSON.stringify(req.body, null, 2));

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Step 1: Accept only product IDs and quantities — NEVER the amount
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log("PAYMENT DEBUG: items array missing or empty");
            return res.status(400).json({ message: "Items array is required with productId and quantity" });
        }

        console.log("Step 1 - Items received:", items.length);

        // Step 2: Strict validation for every item
        for (const item of items) {
            if (!item.productId) {
                console.log("PAYMENT DEBUG: item missing productId:", JSON.stringify(item));
                return res.status(400).json({ message: "Each item must have a productId" });
            }

            if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
                console.log("PAYMENT DEBUG: invalid quantity for item:", JSON.stringify(item));
                return res.status(400).json({
                    message: "Each item must have an integer quantity between 1 and 20"
                });
            }
        }

        // Step 3: Fetch all products from MongoDB by their IDs
        const productIds = items.map(item => item.productId);
        console.log("Step 2 - Product IDs:", productIds);

        let products;
        try {
            // Product.find() with an invalid ObjectId string (e.g. a number, or malformed 24-char hex)
            // throws a Mongoose CastError. We catch that specifically to return a 400 instead of 500.
            products = await Product.find({ _id: { $in: productIds } });
        } catch (dbError) {
            console.error("PAYMENT DEBUG: Product.find() failed — likely an invalid productId format");
            console.error("DB Error name:", dbError.name);
            console.error("DB Error message:", dbError.message);
            // Mongoose CastError for invalid ObjectId
            if (dbError.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid product ID format in request"
                });
            }
            // Re-throw any other DB error (connection, timeout, etc.) to the outer catch
            throw dbError;
        }

        console.log("Step 3 - Products found in DB:", products.length);

        // Step 4: Ensure every requested product actually exists in the database
        if (products.length !== productIds.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            console.log("PAYMENT DEBUG: Missing products:", missingIds);
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

        console.log("Step 4 - Product map built, keys:", Object.keys(productMap));

        // Step 6: Validate prices and calculate total server-side
        let calculatedTotal = 0;
        const orderItems = [];
        for (const item of items) {
            const product = productMap[item.productId];
            console.log(`Step 5 - Processing: ${product.title}, price=${product.price}, qty=${item.quantity}`);

            if (!product.price || product.price <= 0) {
                console.log("PAYMENT DEBUG: Invalid price for product:", product.title, product.price);
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

        console.log("Step 6 - Calculated Total:", calculatedTotal);

        // Step 7: Razorpay accepts amount in paise (1 INR = 100 paise)
        const amountInPaise = Math.round(calculatedTotal * 100);

        // Step 8: Generate a cryptographically strong receipt ID
        // Razorpay enforces a 40-character limit on receipt — "receipt_" + UUID (36) = 44 → rejected.
        // Use "rcpt_" prefix (5) + randomBytes(12) as hex (24) = 29 chars — well under 40.
        const receipt = "rcpt_" + crypto.randomBytes(12).toString('hex');

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
        };

        console.log("Step 7 - Razorpay options:", JSON.stringify(options, null, 2));

        // Step 9: Create Razorpay order with only the server-calculated amount
        let order;
        try {
            order = await razorpay.orders.create(options);
        } catch (razorpayError) {
            console.error("===== RAZORPAY API ERROR =====");
            console.error("Message:", razorpayError.message);
            // Razorpay SDK errors have a nested response object with the API error details
            console.error("Response status:", razorpayError.statusCode);
            console.error("Response body:", razorpayError.error ? JSON.stringify(razorpayError.error, null, 2) : razorpayError.message);
            console.error("===============================");
            return res.status(502).json({
                message: "Payment gateway error. Please try again."
            });
        }

        console.log("Step 8 - Razorpay order created:", order.id);
        console.log("===== PAYMENT CREATE-ORDER SUCCESS =====");

        // Step 10: Return order details + calculated amount + item breakdown
        res.status(200).json({
            ...order,
            calculatedAmount: calculatedTotal,
            items: orderItems
        });
    } catch (error) {
        console.error("========== PAYMENT ROUTE ERROR ==========");
        console.error("Name:", error.name);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("Request body:", JSON.stringify(req.body, null, 2));
        console.error("=========================================");
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
