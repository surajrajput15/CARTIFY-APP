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
const locationRoutes = require('./locationRoutes');

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
router.use('/locations', locationRoutes);

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
      locations: '/api/v1/locations',
    },
  });
});

module.exports = router;