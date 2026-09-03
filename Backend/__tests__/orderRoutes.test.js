const request = require('supertest');
const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const User = require('../models/User');
const { buildTestApp, getCsrfToken } = require('./testApp');

const app = buildTestApp();

// Helper: create a user with properly hashed password
const createTestUser = async ({ name, email, password, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin });
};

describe('Order Routes', () => {
  let userAgent, adminAgent, user, adminUser;

  beforeEach(async () => {
    userAgent = request.agent(app);
    adminAgent = request.agent(app);

    user = await createTestUser({ name: 'Test User', email: 'order@test.com', password: 'Password123' });
    const userLogin = await userAgent.post('/api/auth/login').send({ email: 'order@test.com', password: 'Password123' });
    if (userLogin.status !== 200) throw new Error(`User login failed: ${userLogin.status}`);

    adminUser = await createTestUser({ name: 'Admin', email: 'admin@test.com', password: 'Password123', isAdmin: true });
    const adminLogin = await adminAgent.post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123' });
    if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${adminLogin.status}`);
  });

  describe('GET /api/orders/myorders/:userId', () => {
    it('should return user orders', async () => {
      await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_test',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 100,
      });

      const res = await userAgent.get(`/api/orders/myorders/${user._id}`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].totalPrice).toBe(100);
    });

    it('should reject accessing another user\'s orders', async () => {
      const otherUser = new User({ name: 'Other', email: 'other@test.com', password: 'Password123' });
      await otherUser.save();

      const res = await userAgent.get(`/api/orders/myorders/${otherUser._id}`).expect(403);
      expect(res.body.message).toContain('only view your own orders');
    });

    it('should return empty array for user with no orders', async () => {
      const res = await userAgent.get(`/api/orders/myorders/${user._id}`).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/orders/admin (Admin)', () => {
    it('should return all orders with pagination (admin)', async () => {
      await Order.insertMany([
        {
          userId: user._id,
          orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
          shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
          razorpayOrderId: 'order_1',
          paymentStatus: 'Paid',
          status: 'Processing',
          totalPrice: 100,
        },
        {
          userId: user._id,
          orderItems: [{ productId: '507f1f77bcf86cd799439012', title: 'Test2', price: 200, quantity: 1 }],
          shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
          razorpayOrderId: 'order_2',
          paymentStatus: 'Paid',
          status: 'Delivered',
          totalPrice: 200,
        },
      ]);

      const res = await adminAgent.get('/api/orders/admin').expect(200);
      expect(res.body.orders).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.orders[0].userId).toBeDefined();
    });

    it('should filter by status', async () => {
      await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_test',
        paymentStatus: 'Paid',
        status: 'Delivered',
        totalPrice: 100,
      });

      const res = await adminAgent.get('/api/orders/admin?status=Delivered').expect(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].status).toBe('Delivered');
    });

    it('should reject non-admin user', async () => {
      await userAgent.get('/api/orders/admin').expect(403);
    });
  });

  describe('PATCH /api/orders/:id/status (Admin)', () => {
    it('should update order status (admin)', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_test',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .patch(`/api/orders/${order._id}/status`)
        .set('X-CSRF-Token', csrfToken)
        .send({ status: 'Shipped' })
        .expect(200);

      expect(res.body.order.status).toBe('Shipped');
    });

    it('should reject invalid status', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_test',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .patch(`/api/orders/${order._id}/status`)
        .set('X-CSRF-Token', csrfToken)
        .send({ status: 'InvalidStatus' })
        .expect(400);

      expect(res.body.message).toContain('Status must be one of');
    });

    it('should reject non-admin user', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_test',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .patch(`/api/orders/${order._id}/status`)
        .set('X-CSRF-Token', csrfToken)
        .send({ status: 'Shipped' })
        .expect(403);
    });
  });
});