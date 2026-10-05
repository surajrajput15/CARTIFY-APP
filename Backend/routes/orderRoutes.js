const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');
const { protect, admin, delivery, requirePermission } = require('../middleware/auth');
const { hasPermission } = require('../utils/permissions');
const { auditLogMiddleware } = require('../middleware/auditLog');
const { adminMutateGuard, staffActionGuard } = require('../utils/routeLimiters');
const { orderStatusWorkflow, isValidOrderTransition, isValidDeliveryTransition, canCancelOrder, canFailDelivery } = require('../utils/orderStatus');
const { emitOrderUpdate } = require('../socket/socketServer');
const { restoreOrderStock } = require('../utils/orderFulfillment');

// Order records are built entirely server-side during the payment flow:
//   POST /api/payment/create-order  -> persists a Pending order (server-calculated total)
//   POST /api/payment/verify-payment -> finalises it to Paid / Processing
// There is no client-facing "create order" endpoint. The client never supplies
// prices, totals, items or payment status, so no duplicate order records can be created.

// GET USER'S ORDERS - capped at 100 for legacy array responses; paginated object
// when ?page/?limit is supplied (backward compatible: old clients get an array).
router.get('/myorders/:userId', protect, async (req, res, next) => {
    try {
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: "You can only view your own orders." });
        }
        const wantsPaging = req.query.page !== undefined || req.query.limit !== undefined;
        if (wantsPaging) {
            const pageNum = Math.max(1, parseInt(req.query.page) || 1);
            const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
            const skip = (pageNum - 1) * limitNum;
            const [orders, total] = await Promise.all([
                Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
                Order.countDocuments({ userId: req.params.userId }),
            ]);
            return res.status(200).json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
        }
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(100).lean();
        res.status(200).json(orders);
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Orders fetch error:");
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

const ORDER_STATUSES = Object.keys(orderStatusWorkflow);

// GET ALL ORDERS (Admin) - paginated, rich search & operational filters, with customer & courier info
router.get('/admin', protect, admin, requirePermission('orders.view'), async (req, res, next) => {
    try {
        const { status, paymentStatus, deliveryStatus, stockShortfall, search, dateFrom, dateTo, page, limit } = req.query;
        const query = {};

        if (status && status !== 'all' && ORDER_STATUSES.includes(status)) {
            query.status = status;
        }

        if (paymentStatus && ['Pending', 'Paid', 'Refunded'].includes(paymentStatus)) {
            query.paymentStatus = paymentStatus;
        }

        if (deliveryStatus && deliveryStatus !== 'all') {
            query.deliveryStatus = deliveryStatus;
        }

        if (stockShortfall === 'true') {
            query.stockShortfall = true;
        }

        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const trimmedSearch = (search || '').toString().trim();
        if (trimmedSearch) {
            const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(escaped, 'i');
            const orConditions = [
                { 'shippingAddress.fullName': rx },
                { 'shippingAddress.phone': rx },
                { razorpayPaymentId: rx },
                { razorpayOrderId: rx }
            ];

            if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
                orConditions.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
            }

            const matchedUsers = await User.find({
                $or: [{ name: rx }, { email: rx }]
            }).select('_id').limit(50).lean();

            if (matchedUsers.length > 0) {
                orConditions.push({ userId: { $in: matchedUsers.map(u => u._id) } });
            }

            query.$or = orConditions;
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('userId', 'name email phone')
                .populate('deliveryPartnerId', 'name phone email role')
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
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Admin orders error:");
        res.status(500).json({ message: "Failed to fetch orders." });
    }
});

// UPDATE ORDER STATUS (Admin) - enforced lifecycle transitions + audit.
router.patch('/:id/status', protect, admin, requirePermission('orders.update'), auditLogMiddleware('UPDATE_ORDER_STATUS', 'Order'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
        }

        const existing = await Order.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Order not found" });
        if (existing.status !== status && !isValidOrderTransition(existing.status, status)) {
            return res.status(400).json({ message: `Cannot transition from ${existing.status} to ${status}` });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { returnDocument: 'after' }
        );

        if (!order) return res.status(404).json({ message: "Order not found" });

        if (status === 'Cancelled' && existing.status !== 'Cancelled') {
            await restoreOrderStock(existing);
        }

        emitOrderUpdate(order);

        res.status(200).json({ message: "Order status updated", order });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid order id" });
        }
        logger.error({ err: error }, "Order status update error:");
        res.status(500).json({ message: "Failed to update order status" });
    }
});
// ============================================================================
// DELIVERY ROUTES (Phase 1)
// ============================================================================

/**
 * POST /api/orders/:id/assign-delivery
 * Admin only - Assign delivery partner to order
 */
router.post('/:id/assign-delivery', protect, admin, requirePermission('delivery.assign'), adminMutateGuard, auditLogMiddleware('ASSIGN_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const { deliveryPartnerId } = req.body;

        if (!deliveryPartnerId) {
            return res.status(400).json({ message: 'deliveryPartnerId is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
            return res.status(400).json({ message: 'Invalid delivery partner ID format' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.deliveryStatus === 'delivered' || order.deliveryStatus === 'cancelled' || order.deliveryStatus === 'failed') {
            return res.status(400).json({ message: 'Cannot assign delivery to a completed or cancelled order' });
        }

        const deliveryPartner = await User.findById(deliveryPartnerId);
        if (!deliveryPartner) {
            return res.status(404).json({ message: 'Delivery partner not found' });
        }

        if (deliveryPartner.role !== 'delivery') {
            return res.status(400).json({ message: 'User is not a delivery partner' });
        }

        const now = new Date();

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    deliveryPartnerId: deliveryPartnerId,
                    deliveryStatus: 'assigned',
                    assignedAt: now
                }
            },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: 'Delivery partner assigned successfully',
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Assign delivery error:');
        res.status(500).json({ message: 'Failed to assign delivery partner' });
    }
});

/**
 * POST /api/orders/:id/accept-delivery
 * Delivery partner only - Accept delivery assignment
 */
router.post('/:id/accept-delivery', protect, delivery, staffActionGuard, auditLogMiddleware('ACCEPT_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.deliveryPartnerId) {
            return res.status(400).json({ message: 'No delivery partner assigned to this order' });
        }

        // Admin full-control bypass: admins may act on any delivery order.
        if (!req.user.isAdmin && order.deliveryPartnerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this order' });
        }

        if (!isValidDeliveryTransition(order.deliveryStatus, 'accepted')) {
            return res.status(400).json({
                message: `Cannot accept delivery in current status: ${order.deliveryStatus}. Allowed: assigned`
            });
        }

        const now = new Date();

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    deliveryStatus: 'accepted',
                    acceptedAt: now
                }
            },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: 'Delivery assignment accepted',
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Accept delivery error:');
        res.status(500).json({ message: 'Failed to accept delivery assignment' });
    }
});

/**
 * POST /api/orders/:id/pickup-delivery
 * Delivery partner only - Mark order as picked up
 */
router.post('/:id/pickup-delivery', protect, delivery, staffActionGuard, auditLogMiddleware('PICKUP_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.deliveryPartnerId) {
            return res.status(400).json({ message: 'No delivery partner assigned to this order' });
        }

        // Admin full-control bypass: admins may act on any delivery order.
        if (!req.user.isAdmin && order.deliveryPartnerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this order' });
        }

        if (!isValidDeliveryTransition(order.deliveryStatus, 'picked_up')) {
            return res.status(400).json({
                message: `Cannot pick up in current delivery status: ${order.deliveryStatus}. Allowed: accepted`
            });
        }

        const now = new Date();

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    deliveryStatus: 'picked_up',
                    pickedUpAt: now
                }
            },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: 'Order picked up successfully',
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Pickup delivery error:');
        res.status(500).json({ message: 'Failed to mark order as picked up' });
    }
});

/**
 * POST /api/orders/:id/out-for-delivery
 * Delivery partner only - Mark order as out for delivery
 */
router.post('/:id/out-for-delivery', protect, delivery, staffActionGuard, auditLogMiddleware('OUT_FOR_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.deliveryPartnerId) {
            return res.status(400).json({ message: 'No delivery partner assigned to this order' });
        }

        // Admin full-control bypass: admins may act on any delivery order.
        if (!req.user.isAdmin && order.deliveryPartnerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this order' });
        }

        if (!isValidDeliveryTransition(order.deliveryStatus, 'out_for_delivery')) {
            return res.status(400).json({
                message: `Cannot go out for delivery in current status: ${order.deliveryStatus}. Allowed: picked_up`
            });
        }

        const now = new Date();

        const updateFields = {
            deliveryStatus: 'out_for_delivery',
            outForDeliveryAt: now
        };

        // Mirror the order lifecycle once the parcel actually leaves for delivery.
        // Processing / Packed / Shipped are all valid predecessors of 'Out for Delivery';
        // validating against the shared workflow keeps model and route in sync.
        if (isValidOrderTransition(order.status, 'Out for Delivery')) {
            updateFields.status = 'Out for Delivery';
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: 'Order is out for delivery',
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Out for delivery error:');
        res.status(500).json({ message: 'Failed to mark order as out for delivery' });
    }
});

/**
 * POST /api/orders/:id/complete-delivery
 * Delivery partner only - Mark delivery as completed
 */
router.post('/:id/complete-delivery', protect, delivery, staffActionGuard, auditLogMiddleware('COMPLETE_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.deliveryPartnerId) {
            return res.status(400).json({ message: 'No delivery partner assigned to this order' });
        }

        // Admin full-control bypass: admins may act on any delivery order.
        if (!req.user.isAdmin && order.deliveryPartnerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this order' });
        }

        if (!isValidDeliveryTransition(order.deliveryStatus, 'delivered')) {
            return res.status(400).json({
                message: `Cannot complete delivery in current status: ${order.deliveryStatus}. Allowed: out_for_delivery`
            });
        }

        const now = new Date();

        const updateFields = {
            deliveryStatus: 'delivered',
            deliveredAt: now,
            status: 'Delivered'
        };

        if (order.paymentStatus === 'Pending') {
            updateFields.paymentStatus = 'Paid';
            updateFields.paidAt = now;
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: 'Delivery completed successfully',
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Complete delivery error:');
        res.status(500).json({ message: 'Failed to complete delivery' });
    }
});

/**
 * POST /api/orders/:id/fail-delivery
 * Delivery partner only - Mark delivery as failed
 */
router.post('/:id/fail-delivery', protect, delivery, staffActionGuard, auditLogMiddleware('FAIL_DELIVERY', 'Order'), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.deliveryPartnerId) {
            return res.status(400).json({ message: 'No delivery partner assigned to this order' });
        }

        // Admin full-control bypass: admins may act on any delivery order.
        if (!req.user.isAdmin && order.deliveryPartnerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this order' });
        }

        if (!canFailDelivery(order.deliveryStatus)) {
            return res.status(400).json({
                message: `Cannot fail delivery in current status: ${order.deliveryStatus}. Allowed: assigned, accepted, picked_up, out_for_delivery`
            });
        }

        const now = new Date();

        const updateFields = {
            deliveryStatus: 'failed',
            failedAt: now
        };

        // Only advance the order lifecycle when the transition is legal (i.e. the order
        // has not already reached a terminal state such as Delivered / Cancelled / Refunded).
        if (isValidOrderTransition(order.status, 'Failed')) {
            updateFields.status = 'Failed';
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        emitOrderUpdate(updatedOrder);

        // A failed delivery on an order that never shipped can be resolved by simply
        // cancelling (and refunding) it, so surface whether that path is still open.
        res.status(200).json({
            message: 'Delivery marked as failed',
            order: updatedOrder,
            orderCancellable: canCancelOrder(order.status)
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        logger.error({ err: error }, 'Fail delivery error:');
        res.status(500).json({ message: 'Failed to mark delivery as failed' });
    }
});

/**
 * GET /api/orders/delivery/stats
 * Delivery partner only - Today's headline numbers for the partner dashboard:
 * how many orders are currently assigned/active vs completed/failed today.
 */
router.get('/delivery/stats', protect, delivery, async (req, res, next) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfThisWeek = new Date(startOfToday);
        startOfThisWeek.setDate(startOfThisWeek.getDate() - 6);
        startOfThisWeek.setHours(0, 0, 0, 0);

        const activeStatuses = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];
        // Admin full-control mode: aggregate across all partners.
        const base = req.user.isAdmin ? {} : { deliveryPartnerId: req.user._id };

        const [active, todayCompleted, todayFailed, weekCompleted] = await Promise.all([
            Order.countDocuments({ ...base, deliveryStatus: { $in: activeStatuses } }),
            Order.countDocuments({ ...base, deliveryStatus: 'delivered', deliveredAt: { $gte: startOfToday } }),
            Order.countDocuments({ ...base, deliveryStatus: 'failed', failedAt: { $gte: startOfToday } }),
            Order.countDocuments({ ...base, deliveryStatus: 'delivered', deliveredAt: { $gte: startOfThisWeek } }),
        ]);

        res.status(200).json({
            active,
            todayCompleted,
            todayFailed,
            weekCompleted,
            todayTotal: todayCompleted + todayFailed,
        });
    } catch (error) {
        logger.error({ err: error }, 'Get delivery stats error:');
        res.status(500).json({ message: 'Failed to fetch delivery stats' });
    }
});

/**
 * GET /api/orders/delivery/assigned
 * Delivery partner only - Get orders assigned to this delivery partner
 */
router.get('/delivery/assigned', protect, delivery, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const activeStatuses = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

        const query = {
            ...(req.user.isAdmin ? {} : { deliveryPartnerId: req.user._id }),
            deliveryStatus: { $in: activeStatuses }
        };

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('deliveryPartnerId', 'name phone email')
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
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        logger.error({ err: error }, 'Get assigned orders error:');
        res.status(500).json({ message: 'Failed to fetch assigned orders' });
    }
});

/**
 * GET /api/orders/delivery/completed
 * Delivery partner only - Get orders completed by this delivery partner
 */
router.get('/delivery/completed', protect, delivery, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const query = {
            ...(req.user.isAdmin ? {} : { deliveryPartnerId: req.user._id }),
            deliveryStatus: 'delivered',
            deliveredAt: { $exists: true, $ne: null }
        };

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('deliveryPartnerId', 'name phone email')
                .populate('userId', 'name email')
                .sort({ deliveredAt: -1 })
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
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        logger.error({ err: error }, 'Get completed orders error:');
        res.status(500).json({ message: 'Failed to fetch completed orders' });
    }
});

/**
 * GET /api/orders/delivery/failed
 * Delivery partner only - Get orders with failed delivery
 */
router.get('/delivery/failed', protect, delivery, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const query = {
            ...(req.user.isAdmin ? {} : { deliveryPartnerId: req.user._id }),
            deliveryStatus: 'failed',
            failedAt: { $exists: true, $ne: null }
        };

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('deliveryPartnerId', 'name phone email')
                .populate('userId', 'name email')
                .sort({ failedAt: -1 })
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
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid parameters' });
        }
        logger.error({ err: error }, 'Get failed orders error:');
        res.status(500).json({ message: 'Failed to fetch failed orders' });
    }
});

/**
 * GET /api/orders/admin/delivery
 * Admin only - Get all orders with delivery info
 */
router.get('/admin/delivery', protect, admin, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            deliveryStatus,
            deliveryPartnerId
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (deliveryStatus) {
            query.deliveryStatus = deliveryStatus;
        }

        if (deliveryPartnerId) {
            if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
                return res.status(400).json({ message: 'Invalid delivery partner ID format' });
            }
            query.deliveryPartnerId = deliveryPartnerId;
        }

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('deliveryPartnerId', 'name phone email role')
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
        if (error.name === 'CastError' || error.name === 'ValidationError') {
            return next(error);
        }
        logger.error({ err: error }, 'Admin delivery orders error:');
        res.status(500).json({ message: 'Failed to fetch delivery orders' });
    }
});

// CANCEL ORDER - customer (owner) or admin can cancel an order in cancellable stage.
router.post('/:id/cancel', protect, auditLogMiddleware('CANCEL_ORDER', 'Order'), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid order ID format" });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const isOwner = order.userId.toString() === req.user._id.toString();
        const isAdmin = Boolean(req.user.isAdmin);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to cancel this order" });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: "Order is already cancelled" });
        }

        if (!canCancelOrder(order.status)) {
            return res.status(400).json({ 
                message: `Cannot cancel order in ${order.status} stage. Please contact customer support.` 
            });
        }

        const updateFields = {
            status: 'Cancelled',
        };
        if (order.deliveryStatus && order.deliveryStatus !== 'delivered') {
            updateFields.deliveryStatus = 'cancelled';
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        // Restore stock and release coupon
        await restoreOrderStock(order);

        emitOrderUpdate(updatedOrder);

        res.status(200).json({
            message: "Order cancelled successfully",
            order: updatedOrder
        });
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Order cancellation error:");
        res.status(500).json({ message: "Failed to cancel order" });
    }
});

// GET SINGLE ORDER BY ID - accessible by owner, assigned delivery partner, or admin.
// Placed after all specific static routes (/admin, /delivery/*) so ':id' never captures subroute prefixes.
router.get('/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid order ID format" });
        }

        const order = await Order.findById(id)
            .populate('deliveryPartnerId', 'name phone email role')
            .populate('userId', 'name email phone')
            .lean();

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const orderUserId = order.userId?._id ? order.userId._id.toString() : order.userId?.toString();
        const isOwner = orderUserId === req.user._id.toString();
        const hasOrderPerm = Boolean(req.user.isAdmin) || hasPermission(req.user, 'orders.view');
        const deliveryPartnerId = order.deliveryPartnerId?._id ? order.deliveryPartnerId._id.toString() : order.deliveryPartnerId?.toString();
        const isAssignedDelivery = deliveryPartnerId === req.user._id.toString();

        if (!isOwner && !hasOrderPerm && !isAssignedDelivery) {
            return res.status(403).json({ message: "Not authorized to view this order" });
        }

        res.status(200).json(order);
    } catch (error) {
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return next(error);
        }
        logger.error({ err: error }, "Single order fetch error:");
        res.status(500).json({ message: "Failed to fetch order details." });
    }
});

module.exports = router;
