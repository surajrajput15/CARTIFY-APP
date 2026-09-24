// API Versioning - V1 Router
// This module mounts all v1 routes under /api/v1

const express = require('express');
const router = express.Router();

// NOTE: auth rate limiting lives per-route inside authRoutes.js (credential
// 5/min, session 60/min) and therefore covers /api/v1/auth/* automatically —
// no router-level limiter here, which would double-count against legacy.

// Import v1 routes
const productRoutes = require('./productRoutes');
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const addressRoutes = require('./addressRoutes');
const cartRoutes = require('./cartRoutes');
const paymentRoutes = require('./paymentRoutes');
const couponRoutes = require('./couponRoutes');
const uploadRoutes = require('./uploadRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const categoryRoutes = require('./categoryRoutes');
const adminRoutes = require('./adminRoutes');
const adminDeliveryRoutes = require('./adminDeliveryRoutes');
const adminStaffRoutes = require('./adminStaffRoutes');
const adminUserRoutes = require('./adminUserRoutes');
const locationRoutes = require('./locationRoutes');
const warehouseRoutes = require('./warehouseRoutes');
const warehousePortalRoutes = require('./warehousePortalRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const stockRoutes = require('./stockRoutes');
const campaignRoutes = require('./campaignRoutes');
const reviewRoutes = require('./reviewRoutes');
const notificationRoutes = require('./notificationRoutes');
const auditRoutes = require('./auditRoutes');
const activityRoutes = require('./activityRoutes');

// Mount routes under v1
router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/addresses', addressRoutes);
router.use('/cart', cartRoutes);
router.use('/payment', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/upload', uploadRoutes.router);
router.use('/wishlist', wishlistRoutes);
router.use('/categories', categoryRoutes);
router.use('/admin/analytics', adminRoutes);
router.use('/admin', adminDeliveryRoutes);
router.use('/admin/staff', adminStaffRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin/audit-logs', auditRoutes);
router.use('/admin/user-activity', activityRoutes);
router.use('/locations', locationRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/warehouse', warehousePortalRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/stock', stockRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/campaigns', campaignRoutes);

// V1 API info endpoint
router.get('/', (req, res) => {
  res.json({
    version: '2.0.0',
    name: 'Cartify API',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      products: '/api/v1/products',
      cart: '/api/v1/cart',
      orders: '/api/v1/orders',
      addresses: '/api/v1/addresses',
      payment: '/api/v1/payment',
      coupons: '/api/v1/coupons',
      upload: '/api/v1/upload',
      wishlist: '/api/v1/wishlist',
      categories: '/api/v1/categories',
      'admin-analytics': '/api/v1/admin/analytics',
      'admin-users': '/api/v1/admin/users',
      'admin-audit-logs': '/api/v1/admin/audit-logs',
      'admin-user-activity': '/api/v1/admin/user-activity',
      reviews: '/api/v1/reviews',
      notifications: '/api/v1/notifications',
      locations: '/api/v1/locations',
      warehouses: '/api/v1/warehouses',
      inventory: '/api/v1/inventory',
      stock: '/api/v1/stock',
      campaigns: '/api/v1/campaigns',
    },
  });
});

module.exports = router;