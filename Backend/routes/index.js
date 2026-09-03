// API Versioning - V1 Router
// This module mounts all v1 routes under /api/v1

const express = require('express');
const router = express.Router();

// Import v1 routes
const productRoutes = require('./productRoutes');
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const addressRoutes = require('./addressRoutes');
const cartRoutes = require('./cartRoutes');
const paymentRoutes = require('./paymentRoutes');
const uploadRoutes = require('./uploadRoutes');

// Mount routes under v1
router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/addresses', addressRoutes);
router.use('/cart', cartRoutes);
router.use('/payment', paymentRoutes);
router.use('/upload', uploadRoutes.router);

// V1 API info endpoint
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    name: 'Cartify API',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      products: '/api/v1/products',
      cart: '/api/v1/cart',
      orders: '/api/v1/orders',
      addresses: '/api/v1/addresses',
      payment: '/api/v1/payment',
      upload: '/api/v1/upload',
    },
  });
});

module.exports = router;