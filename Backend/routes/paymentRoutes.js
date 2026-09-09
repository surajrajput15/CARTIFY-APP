const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect, admin } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { finalisePaidOrder } = require('../utils/orderFulfillment');
const rateLimit = require('express-rate-limit');

// Rate limiting for payment endpoints to prevent abuse
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { message: "Too many payment requests, please try again later after 5 minutes" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const razerpayInstance = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('RAZORPAY_KEYS_NOT_CONFIGURED');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

const { normalizeIndianPhone, normalizePinCode } = require('../utils/normalize');

const validateShippingAddress = (address) => {
    if (!address || typeof address !== 'object') return 'Shipping address is required';
    const required = ['fullName', 'phone', 'street', 'city', 'state', 'pinCode'];
    const missing = required.filter((field) => !address[field]);
    if (missing.length > 0) {
        return `Shipping address missing: ${missing.join(', ')}`;
    }
    // Friendly formats accepted ("+91 98765 43210", "110 001") — same rules
    // as the address book, so an order can never be placed with an address
    // the address book would reject.
    if (!normalizeIndianPhone(address.phone)) {
        return 'Phone must be a valid 10-digit Indian number starting with 6, 7, 8 or 9';
    }
    if (!normalizePinCode(address.pinCode)) {
        return 'PIN code must be exactly 6 digits';
    }
    return null;
};

// Helper function to handle Razorpay errors.
// Gateway-side problems (auth, 5xx, network) always surface as 502 so callers
// can distinguish "our request was bad" (400) / "back off" (429) from
// "payment provider failed" (502). Full details stay in server logs.
const handleRazorpayError = (error) => {
    logger.error({ err: error }, "Razorpay API error");

    if (error?.statusCode === 400) {
        return { message: "Invalid request to payment gateway", statusCode: 400 };
    } else if (error?.statusCode === 429) {
        return { message: "Payment gateway rate limit exceeded. Please try again.", statusCode: 429 };
    } else {
        return { message: "Payment gateway error. Please try again.", statusCode: 502 };
    }
};

// 1. CREATE PAYMENT ORDER — SERVER-AUTHORITATIVE
// Recomputes prices from MongoDB, persists a Pending Order, then returns the Razorpay order.
// The client supplies ONLY product ids + quantities and the shipping address.
router.post('/create-order', protect, paymentLimiter, async (req, res, next) => {
    try {
        let razorpay;
        try {
            razorpay = razerpayInstance();
        } catch (err) {
            logger.error("RAZORPAY keys are not configured in environment");
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
            logger.error({ err: dbError }, "Product.find() failed");
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

        // Optional coupon: fully validated server-side against the live cart
        // total BEFORE any charge. Rejects fail fast with 400; usage is only
        // debited later, when the order actually reaches Paid.
        let couponCode = null;
        let discountAmount = 0;
        const rawCoupon = typeof req.body.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : '';
        if (rawCoupon) {
            const coupon = await Coupon.findOne({ code: rawCoupon });
            if (!coupon) {
                return res.status(400).json({ message: 'Invalid coupon code' });
            }
            const now = new Date();
            if (!coupon.isActive || now < coupon.validFrom || now > coupon.validUntil) {
                return res.status(400).json({ message: 'Coupon is expired or inactive' });
            }
            if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
                return res.status(400).json({ message: 'Coupon usage limit reached' });
            }
            // Category check needs live product data (orderItems don't carry it).
            if (coupon.applicableCategories.length > 0) {
                const hasCategory = orderItems.some((oi) => {
                    const cat = productMap[oi.productId.toString()]?.category;
                    return cat && coupon.applicableCategories.includes(cat);
                });
                if (!hasCategory) {
                    return res.status(400).json({ message: 'Coupon not applicable to items in your cart' });
                }
            }
            const applied = coupon.apply(req.user._id, calculatedTotal, orderItems);
            if (!applied.valid) {
                return res.status(400).json({ message: applied.message || 'Coupon cannot be applied' });
            }
            couponCode = coupon.code;
            discountAmount = Math.min(applied.discount, calculatedTotal);
            calculatedTotal = Math.round((calculatedTotal - discountAmount) * 100) / 100;
        }

        const amountInPaise = Math.round(calculatedTotal * 100);
        const receipt = "rcpt_" + crypto.randomBytes(12).toString('hex');

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
        };

        let rzpOrder;
        try {
            // Add timeout for Razorpay API call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Razorpay API timeout')), 8000)
            );
            const createPromise = razorpay.orders.create(options);
            rzpOrder = await Promise.race([createPromise, timeoutPromise]);
        } catch (razorpayError) {
            if (razorpayError.message === 'Razorpay API timeout') {
                return res.status(504).json({
                    message: "Payment gateway timeout. Please try again."
                });
            }
            const errorResponse = handleRazorpayError(razorpayError);
            return res.status(errorResponse.statusCode).json({
                message: errorResponse.message
            });
        }

        // Persist a Pending Order BEFORE returning — binds razorpay_order_id, server items,
        // server total, userId and Pending paymentStatus to Mongo. A TTL expiry is attached so
        // abandoned checkouts are auto-purged after 24h instead of accumulating forever.
        // Store the canonical digits (validation above guarantees non-null).
        const canonicalAddress = {
            ...shippingAddress,
            phone: normalizeIndianPhone(shippingAddress.phone),
            pinCode: normalizePinCode(shippingAddress.pinCode),
        };
        const pendingOrder = new Order({
            userId: req.user._id,
            orderItems,
            shippingAddress: canonicalAddress,
            razorpayOrderId: rzpOrder.id,
            paymentStatus: 'Pending',
            status: 'Pending',
            totalPrice: calculatedTotal,
            couponCode,
            discountAmount,
            expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        let savedOrder;
        try {
            savedOrder = await pendingOrder.save();
        } catch (saveError) {
            logger.error({ err: saveError }, "Pending order save failed");
            throw saveError;
        }

        res.status(200).json({
            order: {
                ...rzpOrder,
                calculatedAmount: calculatedTotal,
                items: orderItems,
                coupon: couponCode ? { code: couponCode, discountAmount } : null
            },
            orderId: savedOrder._id
        });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Payment create-order error");
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
router.post('/verify-payment', protect, paymentLimiter, async (req, res) => {
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
            // Add timeout for Razorpay API call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Razorpay API timeout')), 8000)
            );
            const fetchPromise = razerpayInstance().orders.fetch(razorpay_order_id);
            rzpOrder = await Promise.race([fetchPromise, timeoutPromise]);
        } catch (rzpError) {
            if (rzpError.message === 'Razorpay API timeout') {
                return res.status(504).json({ message: "Payment gateway timeout. Please try again.", success: false });
            }
            const errorResponse = handleRazorpayError(rzpError);
            return res.status(errorResponse.statusCode).json({ message: errorResponse.message, success: false });
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
        logger.error({ err: error }, "Payment verification error:");
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
        logger.info(`Webhook received: ${event.event}${event.payload?.payment?.entity?.order_id ? ` for order ${event.payload.payment.entity.order_id}` : ''}`);

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
                logger.error(`Webhook amount mismatch for order ${orderId}`);
                return res.status(200).json({ ok: true, skipped: 'amount mismatch' });
            }

            const result = await finalisePaidOrder(order, { paymentId: payment.id });
            logger.info(`Webhook processed: payment.captured -> order ${orderId} (${result.transition})`);
            return res.status(200).json({ ok: true, ...result });
        }

        return res.status(200).json({ ok: true, skipped: 'unhandled event' });
    } catch (error) {
        logger.error({ err: error }, "Webhook processing error:");
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
            logger.error("RAZORPAY keys are not configured in environment");
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
        const errorResponse = handleRazorpayError(error);
        res.status(errorResponse.statusCode).json({ message: errorResponse.message });
    }
});

module.exports = router;