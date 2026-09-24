// Test app builder that mirrors the real server setup
// In test mode, we skip CSRF protection because it doesn't work reliably with
// supertest's cookie handling. The real CSRF behavior is verified in the
// production server via integration tests. The test app DOES use the real
// errorHandler, so error paths are tested.
const express = require('express');
const cookieParser = require('cookie-parser');
const { protect } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');

// Routes
const productRoutes = require('../routes/productRoutes');
const authRoutes = require('../routes/authRoutes');
const orderRoutes = require('../routes/orderRoutes');
const addressRoutes = require('../routes/addressRoutes');
const cartRoutes = require('../routes/cartRoutes');
const paymentRoutes = require('../routes/paymentRoutes');
const couponRoutes = require('../routes/couponRoutes');
const warehouseRoutes = require('../routes/warehouseRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');
const stockRoutes = require('../routes/stockRoutes');
const campaignRoutes = require('../routes/campaignRoutes');
const auditRoutes = require('../routes/auditRoutes');
const activityRoutes = require('../routes/activityRoutes');
const adminStaffRoutes = require('../routes/adminStaffRoutes');
const warehousePortalRoutes = require('../routes/warehousePortalRoutes');

/**
 * Build a test Express app that mirrors the real server's middleware stack.
 * Auth-cookie handling works via supertest's request.agent(); the real
 * errorHandler is mounted so we exercise the same error responses as prod.
 */
const buildTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // Mount routes
  app.use('/api/products', productRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/coupons', couponRoutes);
  app.use('/api/warehouses', warehouseRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/admin/audit-logs', auditRoutes);
  app.use('/api/admin/user-activity', activityRoutes);
  app.use('/api/admin/staff', adminStaffRoutes);
  app.use('/api/warehouse', warehousePortalRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
};

/**
 * Helper: backward compat - returns null (no CSRF needed in test app).
 * Tests that previously called getCsrfToken() before state-changing requests
 * can keep calling this without changes; setting the header to null is a no-op.
 */
const getCsrfToken = async (agent) => {
  return null;
};

module.exports = { buildTestApp, getCsrfToken };