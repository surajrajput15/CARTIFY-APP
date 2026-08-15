const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect, admin } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { finalisePaidOrder } = require('../utils/orderFulfillment');

const razerpayInstance = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('RAZORPAY_KEYS_NOT_CONFIGURED');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

const validateShippingAddress = (address) => {
    if (!address || typeof address !== 'object') return 'Shipping address is required';
    const required = ['fullName', 'phone', 'street', 'city', 'state', 'pinCode'];
    const missing = required.filter((field) => !address[field]);
    if (missing.length > 0) {
        return `Shipping address missing: ${missing.join(', ')}`;
    }
    return null;
};

// 1. CREATE PAYMENT ORDER — SERVER-AUTHORITATIVE
// Recomputes prices from MongoDB, persists a Pending Order, then returns the Razorpay order.
// The client supplies ONLY product ids + quantities and the shipping address.
router.post('/create-order', protect, async (req, res, next) => {
    try {
        let razorpay;
        try {
            razorpay = razerpayInstance();
        } catch (err) {
            console.error("RAZORPAY keys are not configured in environment");
            return res.status(500).json({ message: "Payment service is not configured" });
        }

        const { items, shippingAddress } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Items array is required with productId and quantity" });
        }

        const addressError = validateShippingAddress(shippingAddress);
        if (addressError) {
            return res.status(400).json({ message: addressError });
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

        const productIdSet = [...new Set(items.map(item => item.productId))];

        let products;
        try {
            products = await Product.find({ _id: { $in: productIdSet } });
        } catch (dbError) {
            console.error("Product.find() failed:", dbError.name, dbError.message);
            if (dbError.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid product ID format in request"
                });
            }
            throw dbError;
        }

        if (products.length !== productIdSet.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIdSet.filter(id => !foundIds.includes(id));
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

            // Early stock gate: reject quantities that can never be fulfilled by the CURRENT
            // stock (tracked stock only — legacy products without a numeric countInStock are
            // skipped, matching verify-time behaviour). This prevents a user from being put
            // through a full Razorpay charge for a quantity that is already impossible to ship.
            // A concurrent purchase can still deplete stock between this check and payment; that
            // remainder is handled at verify-time by the atomic $gte reservation + 409 shortfall.
            if (product.countInStock != null && item.quantity > product.countInStock) {
                return res.status(400).json({
                    message: `Only ${product.countInStock} unit(s) of "${product.title}" are available in stock`
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

        // Round to 2 decimals to guard against floating point drift
        calculatedTotal = Math.round(calculatedTotal * 100) / 100;
        const amountInPaise = Math.round(calculatedTotal * 100);
        const receipt = "rcpt_" + crypto.randomBytes(12).toString('hex');

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
        };

        let rzpOrder;
        try {
            rzpOrder = await razorpay.orders.create(options);
        } catch (razorpayError) {
            console.error("Razorpay API error:", razorpayError.statusCode, razorpayError.message);
            return res.status(502).json({
                message: "Payment gateway error. Please try again."
            });
        }

        // Persist a Pending Order BEFORE returning — binds razorpay_order_id, server items,
        // server total, userId and Pending paymentStatus to Mongo. A TTL expiry is attached so
        // abandoned checkouts are auto-purged after 24h instead of accumulating forever.
        const pendingOrder = new Order({
            userId: req.user._id,
            orderItems,
            shippingAddress,
            razorpayOrderId: rzpOrder.id,
            paymentStatus: 'Pending',
            status: 'Pending',
            totalPrice: calculatedTotal,
            expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        let savedOrder;
        try {
            savedOrder = await pendingOrder.save();
        } catch (saveError) {
            console.error("Pending order save failed:", saveError.name, saveError.message);
            throw saveError;
        }

        res.status(200).json({
            order: {
                ...rzpOrder,
                calculatedAmount: calculatedTotal,
                items: orderItems
            },
            orderId: savedOrder._id
        });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        console.error("Payment create-order error:", error.name, error.message);
        res.status(500).json({ message: "Error creating Razorpay order" });
    }
});

// 2. VERIFY PAYMENT — SIGNATURE + SERVER-STATE TRANSITION
//    Idempotent and replay-safe:
//      - Re-sending the SAME valid payment returns success (the order is already Paid).
//      - A different payment against the same order is rejected.
//      - The Pending -> Paid transition is atomic, so concurrent verify requests
//        cannot double-finalise an order.
//    Only Razorpay-signed payloads are accepted; the amount is re-checked against the
//    server-persisted total. The client never supplies a price or a payment state.
router.post('/verify-payment', protect, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing payment verification fields", success: false });
        }

        // 1) Locate the order for this Razorpay order id, scoped to the authenticated user.
        const order = await Order.findOne({
            razorpayOrderId: razorpay_order_id,
            userId: req.user._id
        });

        if (!order) {
            return res.status(400).json({
                message: "No order found for this payment. Please check the Razorpay order id.",
                success: false
            });
        }

        // 2) Duplicate / replay protection — idempotent by design.
        if (order.paymentStatus === 'Paid') {
            if (order.razorpayPaymentId === razorpay_payment_id) {
                // Same payment already verified → safe replay, return success.
                return res.status(200).json({
                    message: "Payment verified successfully",
                    success: true,
                    order
                });
            }
            return res.status(400).json({
                message: "This payment has already been processed for a different transaction",
                success: false
            });
        }

        // 3) HMAC signature check (server-side secret only).
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ message: "Invalid signature sent!", success: false });
        }

        // 4) Amount match — confirm the Razorpay order amount equals the server-persisted total.
        let rzpOrder;
        try {
            rzpOrder = await razerpayInstance().orders.fetch(razorpay_order_id);
        } catch (rzpError) {
            console.error("Razorpay order fetch failed:", rzpError.message);
            return res.status(502).json({ message: "Payment gateway error. Please try again.", success: false });
        }

        if (rzpOrder.id !== razorpay_order_id || Number(rzpOrder.amount) !== Math.round(order.totalPrice * 100)) {
            return res.status(400).json({ message: "Payment amount mismatch", success: false });
        }

        // 5) Atomic transition Pending -> Paid + stock reservation, shared with the
        //    Razorpay webhook so a captured payment is reconciled exactly once.
        const result = await finalisePaidOrder(order, { paymentId: razorpay_payment_id });

        if (!result.finalised) {
            // Lost the race — another request/webhook already finalised this order.
            return res.status(200).json({
                message: "Payment verified successfully",
                success: true,
                order
            });
        }

        if (result.shortfall) {
            return res.status(409).json({
                message: "Your payment was captured for the full amount, but one or more items went out of stock during checkout. Your order is safely recorded and our team will contact you shortly to arrange a refund for the unavailable items.",
                success: false,
                order: result.order
            });
        }

        res.status(200).json({
            message: "Payment verified successfully",
            success: true,
            order: result.order
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ message: "Error verifying payment", success: false });
    }
});

// 3. RAZORPAY WEBHOOK — server-to-server payment reconciliation.
//    This is the safety net for the client-side verify-payment call: if the browser
//    disconnects after Razorpay captures the money (before the client can call
//    /verify-payment), this webhook finalises the order so payment is never lost.
//    Signature is verified over the RAW request body (see server.js mounting it ahead
//    of express.json()). The same atomic Pending -> Paid transition makes this
//    idempotent against a concurrent client verify call.
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature || !Buffer.isBuffer(req.body)) {
            return res.status(400).json({ ok: false, message: 'Missing signature or raw body' });
        }

        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(req.body)
            .digest('hex');

        if (signature !== expectedSign) {
            return res.status(400).json({ ok: false, message: 'Invalid signature' });
        }

        const event = JSON.parse(req.body.toString('utf8'));
        console.log(`Webhook received: ${event.event}${event.payload?.payment?.entity?.order_id ? ` for order ${event.payload.payment.entity.order_id}` : ''}`);

        if (event.event === 'payment.captured') {
            const payment = event.payload?.payment?.entity;
            const orderId = payment?.order_id;

            if (!orderId) {
                return res.status(200).json({ ok: true, skipped: 'no order_id' });
            }

            const order = await Order.findOne({ razorpayOrderId: orderId });
            if (!order) {
                return res.status(200).json({ ok: true, skipped: 'order not found' });
            }

            if (order.paymentStatus !== 'Pending') {
                return res.status(200).json({ ok: true, skipped: 'already processed' });
            }

            // Defense in depth: re-check the captured amount against the server total.
            if (Number(payment.amount) !== Math.round(order.totalPrice * 100)) {
                console.error(`Webhook amount mismatch for order ${orderId}`);
                return res.status(200).json({ ok: true, skipped: 'amount mismatch' });
            }

            const result = await finalisePaidOrder(order, { paymentId: payment.id });
            console.log(`Webhook processed: payment.captured -> order ${orderId} (${result.transition})`);
            return res.status(200).json({ ok: true, ...result });
        }

        return res.status(200).json({ ok: true, skipped: 'unhandled event' });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ ok: false });
    }
});

// 4. ADMIN REFUND — issue a Razorpay refund for a paid order (e.g. stockShortfall
//    orders that could not be fulfilled) and mark it Refunded/Cancelled.
router.post('/refund/:orderId', protect, admin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.paymentStatus !== 'Paid') {
            return res.status(400).json({ message: 'Only paid orders can be refunded' });
        }
        if (!order.razorpayPaymentId) {
            return res.status(400).json({ message: 'No Razorpay payment id on this order' });
        }

        let razorpay;
        try {
            razorpay = razerpayInstance();
        } catch (err) {
            console.error("RAZORPAY keys are not configured in environment");
            return res.status(500).json({ message: "Payment service is not configured" });
        }

        const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
            amount: Math.round(order.totalPrice * 100)
        });

        const updated = await Order.findByIdAndUpdate(
            order._id,
            { $set: { paymentStatus: 'Refunded', status: 'Cancelled', refundId: refund.id } },
            { returnDocument: 'after' }
        );

        res.status(200).json({ message: 'Refund initiated', refund, order: updated });
    } catch (error) {
        console.error("Refund error:", error.name, error.message);
        res.status(500).json({ message: 'Refund failed' });
    }
});

module.exports = router;