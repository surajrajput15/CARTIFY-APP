const request = require('supertest');
const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
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

  describe('GET /api/orders/:id', () => {
    let testOrder;
    beforeEach(async () => {
      testOrder = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test Item', price: 500, quantity: 1 }],
        shippingAddress: { fullName: 'Test Owner', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_track_test',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 500,
      });
    });

    it('should allow owner to fetch their single order by id', async () => {
      const res = await userAgent.get(`/api/orders/${testOrder._id}`).expect(200);
      expect(res.body._id).toBe(testOrder._id.toString());
      expect(res.body.totalPrice).toBe(500);
      expect(res.body.status).toBe('Processing');
    });

    it('should allow admin to fetch any order by id', async () => {
      const res = await adminAgent.get(`/api/orders/${testOrder._id}`).expect(200);
      expect(res.body._id).toBe(testOrder._id.toString());
    });

    it('should reject non-owner, non-admin user from viewing the order', async () => {
      const otherAgent = request.agent(app);
      await createTestUser({ name: 'Intruder', email: 'intruder@test.com', password: 'Password123' });
      await otherAgent.post('/api/auth/login').send({ email: 'intruder@test.com', password: 'Password123' });

      const res = await otherAgent.get(`/api/orders/${testOrder._id}`).expect(403);
      expect(res.body.message).toContain('Not authorized to view this order');
    });

    it('should return 404 for non-existent order id', async () => {
      const nonExistentId = '507f1f77bcf86cd799439099';
      const res = await userAgent.get(`/api/orders/${nonExistentId}`).expect(404);
      expect(res.body.message).toContain('Order not found');
    });

    it('should return 400 for malformed order id', async () => {
      const res = await userAgent.get('/api/orders/not-an-id').expect(400);
      expect(res.body.message).toContain('Invalid order ID format');
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

    it('should restore stock when admin cancels a paid order', async () => {
      const product = await Product.create({
        title: 'Cancel Restock Item',
        description: 'Test description for item',
        price: 250,
        countInStock: 5,
        category: 'Electronics',
        image: 'https://example.com/test.jpg'
      });
      const warehouse = await Warehouse.create({
        name: 'Cancel Test Warehouse',
        code: 'CTW1',
        city: 'Delhi',
        state: 'Delhi'
      });
      const inv = await InventoryItem.create({
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: 5
      });

      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: product._id, title: product.title, price: 250, quantity: 2 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 500,
      });

      const csrfToken = await getCsrfToken(adminAgent);
      const res = await adminAgent
        .patch(`/api/orders/${order._id}/status`)
        .set('X-CSRF-Token', csrfToken)
        .send({ status: 'Cancelled' })
        .expect(200);

      expect(res.body.order.status).toBe('Cancelled');

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.countInStock).toBe(7); // 5 + 2

      const updatedInv = await InventoryItem.findById(inv._id);
      expect(updatedInv.quantity).toBe(7); // 5 + 2
    });
  });

  describe('POST /api/orders/:id/cancel (Customer Order Cancellation)', () => {
    it('should allow customer to cancel their own Processing order and restore stock', async () => {
      const product = await Product.create({
        title: 'Self Cancel Item',
        description: 'Test item description',
        price: 150,
        countInStock: 8,
        category: 'Home',
        image: 'https://example.com/item.jpg'
      });
      const warehouse = await Warehouse.create({
        name: 'Self Cancel Warehouse',
        code: 'SCW1',
        city: 'Mumbai',
        state: 'MH'
      });
      await InventoryItem.create({
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: 8
      });

      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: product._id, title: product.title, price: 150, quantity: 3 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 450,
      });

      const csrfToken = await getCsrfToken(userAgent);
      const res = await userAgent
        .post(`/api/orders/${order._id}/cancel`)
        .set('X-CSRF-Token', csrfToken)
        .send({})
        .expect(200);

      expect(res.body.message).toContain('Order cancelled successfully');
      expect(res.body.order.status).toBe('Cancelled');

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.countInStock).toBe(11); // 8 + 3
    });

    it('should reject cancellation from unauthorized user', async () => {
      const otherUser = await createTestUser({ name: 'Attacker', email: 'attacker@test.com', password: 'Password123' });
      const order = await Order.create({
        userId: otherUser._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Other', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(userAgent);
      await userAgent
        .post(`/api/orders/${order._id}/cancel`)
        .set('X-CSRF-Token', csrfToken)
        .send({})
        .expect(403);
    });

    it('should reject cancelling order that is already Shipped or Delivered', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        paymentStatus: 'Paid',
        status: 'Shipped',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(userAgent);
      const res = await userAgent
        .post(`/api/orders/${order._id}/cancel`)
        .set('X-CSRF-Token', csrfToken)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('Cannot cancel order in Shipped stage');
    });

    it('should reject cancelling an order that is already Cancelled', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test', price: 100, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        paymentStatus: 'Paid',
        status: 'Cancelled',
        totalPrice: 100,
      });

      const csrfToken = await getCsrfToken(userAgent);
      const res = await userAgent
        .post(`/api/orders/${order._id}/cancel`)
        .set('X-CSRF-Token', csrfToken)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('already cancelled');
    });
  });
});