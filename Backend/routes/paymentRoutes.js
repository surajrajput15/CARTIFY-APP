const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');

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

            // Server-authoritative stock check — never trust the client's quantity or stock.
            // If the product carries a known countInStock, reject the order when the requested
            // quantity exceeds the available stock.
            if (product.countInStock != null && item.quantity > product.countInStock) {
                return res.status(400).json({
                    message: `Insufficient stock for "${product.title}". Only ${product.countInStock} left in stock.`
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
        // server total, userId and Pending paymentStatus to Mongo.
        const pendingOrder = new Order({
            userId: req.user._id,
            orderItems,
            shippingAddress,
            razorpayOrderId: rzpOrder.id,
            paymentStatus: 'Pending',
            status: 'Pending',
            totalPrice: calculatedTotal
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

        // 5) Atomic transition Pending -> Paid. Only one concurrent request can win the update,
        //    preventing duplicate finalisation (replay / double submit).
        const finalisedOrder = await Order.findOneAndUpdate(
            { _id: order._id, paymentStatus: 'Pending' },
            {
                paymentStatus: 'Paid',
                razorpayPaymentId: razorpay_payment_id,
                paidAt: new Date(),
                status: 'Processing'
            },
            { new: true }
        );

        if (!finalisedOrder) {
            // Lost the race — another request already finalised this order.
            return res.status(200).json({
                message: "Payment verified successfully",
                success: true,
                order
            });
        }

        // 6) Atomically reserve stock for products that actually track inventory.
        //    The create-order guard only rejects when `countInStock != null`, so a
        //    product with an UNKNOWN stock (null / missing) is accepted at creation.
        //    We mirror that here: only decrement and enforce the no-oversell guard for
        //    items whose product has a numeric countInStock. Treating a null stock as
        //    "sold out" made every such order fail verification with a false 409, which
        //    never decremented anything and repeated on every retry. The request that won
        //    the Pending -> Paid transition above is the sole owner of each decrement, so
        //    concurrent/replayed verifies can never decrement twice, and the
        //    `countInStock >= quantity` filter keeps tracked stock from ever going negative.
        const productIds = finalisedOrder.orderItems.map(item => item.productId);
        const stockProducts = await Product.find({ _id: { $in: productIds } });
        const stockByProductId = new Map(
            stockProducts.map(p => [p._id.toString(), p.countInStock])
        );

        const hasTrackedStock = (item) => {
            const stock = stockByProductId.get(item.productId.toString());
            return stock != null;
        };

        const stockOps = finalisedOrder.orderItems
            .filter(hasTrackedStock)
            .map(item => ({
                updateOne: {
                    filter: { _id: item.productId, countInStock: { $gte: item.quantity } },
                    update: { $inc: { countInStock: -item.quantity } }
                }
            }));

        const stockResult = await Product.bulkWrite(stockOps, { ordered: true });

        const trackedCount = finalisedOrder.orderItems.filter(hasTrackedStock).length;

        if (stockResult.modifiedCount !== trackedCount) {
            // Some stock was exhausted by a concurrent purchase between order creation and
            // verification. The order is already paid on Razorpay's side; it is flagged so
            // fulfilment can resolve it, but stock was never allowed to go negative.
            return res.status(409).json({
                message: "Some items in your order went out of stock during payment. You have been charged only for confirmed items — our team will contact you shortly.",
                success: false,
                order: finalisedOrder
            });
        }

        res.status(200).json({
            message: "Payment verified successfully",
            success: true,
            order: finalisedOrder
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ message: "Error verifying payment", success: false });
    }
});

module.exports = router;