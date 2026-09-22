const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

// All metrics are computed from the database via MongoDB aggregation —
// no mock/fake dashboard numbers. Scope rules:
//   Revenue / order counts  → Paid orders only (paymentStatus: 'Paid');
//                             Cancelled/Refunded/Failed are excluded from revenue.
//   Active deliveries       → deliveryStatus in [assigned, accepted,
//                             picked_up, out_for_delivery]
const PAID_FILTER = { paymentStatus: 'Paid' };
const EXCLUDED_FROM_REVENUE = ['Cancelled', 'Refunded', 'Failed'];
const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

const parseRange = (range) => {
  const days = Math.min(365, Math.max(7, parseInt(range, 10) || 30));
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { days, start };
};

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/v1/admin/analytics/overview — dashboard summary cards
router.get('/overview', protect, admin, async (req, res, next) => {
  try {
    const { days: rangeDays } = parseRange(req.query.range);

    const [
      revenueAgg,
      orderCounts,
      userCount,
      productCount,
      lowStockCount,
      activeDeliveryCount,
      pendingDeliveryAssignment,
      todayRevenueAgg,
      todayOrdersAgg
    ] = await Promise.all([
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({}),
      Product.countDocuments({ countInStock: { $gt: 0, $lte: 5 } }),
      Order.countDocuments({ deliveryStatus: { $in: ACTIVE_DELIVERY_STATUSES } }),
      Order.countDocuments({ deliveryStatus: 'not_assigned', status: { $nin: EXCLUDED_FROM_REVENUE } }),
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE }, createdAt: { $gte: todayStart() } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Order.countDocuments({ createdAt: { $gte: todayStart() } })
    ]);

    const statusMap = new Map(orderCounts.map((r) => [r._id, r.count]));

    res.status(200).json({
      revenue: revenueAgg[0]?.total || 0,
      todayRevenue: todayRevenueAgg[0]?.total || 0,
      totalOrders: [...orderCounts.values()].reduce((s, r) => s + r.count, 0),
      todayOrders: todayOrdersAgg,
      totalUsers: userCount,
      totalProducts: productCount,
      pendingOrders: (statusMap.get('Pending') || 0) + (statusMap.get('Confirmed') || 0),
      processingOrders: (statusMap.get('Processing') || 0) + (statusMap.get('Packed') || 0),
      shippedOrders: (statusMap.get('Shipped') || 0) + (statusMap.get('Out for Delivery') || 0),
      deliveredOrders: statusMap.get('Delivered') || 0,
      cancelledOrders: (statusMap.get('Cancelled') || 0) + (statusMap.get('Failed') || 0),
      lowStockCount,
      activeDeliveries: activeDeliveryCount,
      pendingDeliveryAssignment,
      rangeDays
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics overview error');
    next(error);
  }
});

// GET /api/v1/admin/analytics/charts — chart series for the admin dashboard
router.get('/charts', protect, admin, async (req, res, next) => {
  try {
    const { days, start } = parseRange(req.query.range);

    const [revenueSeries, statusSeries, bestSellers, categoryPerf, topCustomers, deliverySeries] = await Promise.all([
      // Revenue over time (Paid only, day buckets)
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE }, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } },
            revenue: { $sum: '$totalPrice' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Orders over time by status (day buckets)
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { day: { $dateTrunc: { date: '$createdAt', unit: 'day' } }, status: '$status' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1 } }
      ]),
      // Best-selling products (quantity × revenue, Paid only)
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE } } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.productId',
            title: { $first: '$orderItems.title' },
            units: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 }
      ]),
      // Category performance (Paid orders, revenue grouped by product category)
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE } } },
        { $unwind: '$orderItems' },
        { $lookup: { from: 'products', localField: 'orderItems.productId', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$product.category',
            units: { $sum: '$orderItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
      ]),
      // Top customers (by paid revenue)
      Order.aggregate([
        { $match: { ...PAID_FILTER, status: { $nin: EXCLUDED_FROM_REVENUE } } },
        {
          $group: {
            _id: '$userId',
            revenue: { $sum: '$totalPrice' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { revenue: 1, orderCount: 1, name: '$user.name', email: '$user.email' } }
      ]),
      // Deliveries completed per day
      Order.aggregate([
        { $match: { deliveryStatus: 'delivered', deliveredAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$deliveredAt', unit: 'day' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.status(200).json({
      rangeDays: days,
      revenueSeries,
      statusSeries,
      bestSellers,
      categoryPerformance: categoryPerf,
      topCustomers,
      deliverySeries
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics charts error');
    next(error);
  }
});

// GET /api/v1/admin/analytics/customers — customer list with order stats
router.get('/customers', protect, admin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();

    const userFilter = { role: 'customer' };
    if (search) {
      // Escape regex metacharacters (same defence as the product search).
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      userFilter.$or = [{ name: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(userFilter).select('name email phone createdAt role isAdmin').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(userFilter)
    ]);

    // Per-customer order aggregates for the CURRENT page (single query).
    const ids = users.map((u) => u._id);
    const orderAgg = await Order.aggregate([
      { $match: { userId: { $in: ids }, paymentStatus: 'Paid' } },
      { $group: { _id: '$userId', orderCount: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } }
    ]);
    const aggMap = new Map(orderAgg.map((r) => [r._id.toString(), r]));

    res.status(200).json({
      customers: users.map((u) => ({
        ...u,
        orderCount: aggMap.get(u._id.toString())?.orderCount || 0,
        totalSpent: aggMap.get(u._id.toString())?.revenue || 0
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics customers error');
    next(error);
  }
});

// GET /api/v1/admin/analytics/inventory — stock overview + low-stock list
router.get('/inventory', protect, admin, async (req, res, next) => {
  try {
    const lowStockThreshold = Math.min(50, Math.max(1, parseInt(req.query.lowStockThreshold) || 5));

    const [totalSkus, outOfStock, lowStock, aggregate, lowStockProducts, outOfStockProducts] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ countInStock: 0 }),
      Product.countDocuments({ countInStock: { $gt: 0, $lte: lowStockThreshold } }),
      Product.aggregate([
        { $group: { _id: null, totalUnits: { $sum: '$countInStock' }, avgPrice: { $avg: '$price' } } }
      ]),
      Product.find({ countInStock: { $gt: 0, $lte: lowStockThreshold } })
        .select('title category countInStock price image')
        .sort({ countInStock: 1 })
        .limit(20)
        .lean(),
      Product.find({ countInStock: 0 })
        .select('title category price image')
        .limit(20)
        .lean()
    ]);

    res.status(200).json({
      totalSkus,
      outOfStock,
      lowStock,
      totalUnits: aggregate[0]?.totalUnits || 0,
      avgPrice: aggregate[0]?.avgPrice || 0,
      lowStockProducts,
      outOfStockProducts,
      lowStockThreshold
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics inventory error');
    next(error);
  }
});

// GET /api/v1/admin/analytics/delivery — delivery ops overview
router.get('/delivery', protect, admin, async (req, res, next) => {
  try {
    const [byStatus, partnerLoad, todayDelivered] = await Promise.all([
      Order.aggregate([
        { $group: { _id: '$deliveryStatus', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { deliveryStatus: { $in: ACTIVE_DELIVERY_STATUSES } } },
        { $group: { _id: '$deliveryPartnerId', activeCount: { $sum: 1 } } },
        { $sort: { activeCount: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'partner' } },
        { $unwind: { path: '$partner', preserveNullAndEmptyArrays: true } },
        { $project: { activeCount: 1, name: '$partner.name', email: '$partner.email' } }
      ]),
      Order.countDocuments({ deliveryStatus: 'delivered', deliveredAt: { $gte: todayStart() } })
    ]);

    const statusMap = new Map(byStatus.map((r) => [r._id, r.count]));

    res.status(200).json({
      notAssigned: statusMap.get('not_assigned') || 0,
      assigned: statusMap.get('assigned') || 0,
      accepted: statusMap.get('accepted') || 0,
      pickedUp: statusMap.get('picked_up') || 0,
      outForDelivery: statusMap.get('out_for_delivery') || 0,
      delivered: statusMap.get('delivered') || 0,
      failed: statusMap.get('failed') || 0,
      cancelled: statusMap.get('cancelled') || 0,
      todayDelivered,
      partnerLoad
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics delivery error');
    next(error);
  }
});

module.exports = router;
