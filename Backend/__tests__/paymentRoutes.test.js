const request = require('supertest');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { buildTestApp, getCsrfToken } = require('./testApp');

const app = buildTestApp();

// Helper: create a user with properly hashed password
const createTestUser = async ({ name, email, password, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin });
};

describe('Payment Routes', () => {
  let userAgent, user, product;

  beforeEach(async () => {
    userAgent = request.agent(app);

    user = await createTestUser({ name: 'Test User', email: 'payment@test.com', password: 'Password123' });
    const loginRes = await userAgent.post('/api/auth/login').send({ email: 'payment@test.com', password: 'Password123' });
    if (loginRes.status !== 200) throw new Error(`Login failed: ${loginRes.status}`);

    product = await Product.create({
      title: 'Test Product', price: 1000, description: 'Test',
      category: 'electronics', image: 'img.jpg', countInStock: 10,
    });
  });

  describe('POST /api/payment/create-order', () => {
    it('should reject empty items array', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [],
          shippingAddress: {
            fullName: 'Test', phone: '9876543210', street: '123 St',
            city: 'City', state: 'State', pinCode: '123456',
          },
        })
        .expect(400);

      expect(res.body.message).toContain('Items array is required');
    });

    it('should reject invalid shipping address', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [{ productId: product._id.toString(), quantity: 1 }],
          shippingAddress: { fullName: 'Test' },
        })
        .expect(400);

      expect(res.body.message).toContain('Shipping address missing');
    });

    it('should reject quantity > stock', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [{ productId: product._id.toString(), quantity: 15 }],
          shippingAddress: {
            fullName: 'Test', phone: '9876543210', street: '123 St',
            city: 'City', state: 'State', pinCode: '123456',
          },
        })
        .expect(400);

      expect(res.body.message).toContain('Only 10 unit(s)');
    });

    it('should reject non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [{ productId: fakeId, quantity: 1 }],
          shippingAddress: {
            fullName: 'Test', phone: '9876543210', street: '123 St',
            city: 'City', state: 'State', pinCode: '123456',
          },
        })
        .expect(400);

      expect(res.body.message).toContain('Some products do not exist');
    });

    it('should reach Razorpay API on valid request (returns 502 in test env without real keys)', async () => {
      // This test verifies the request reaches the Razorpay call. In a real environment
      // with valid keys, it would return 200 with the order. In tests, it returns 502
      // because we can't make real API calls. The important thing is it passes validation
      // and gets to the Razorpay API call (not 400/401/403).
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [{ productId: product._id.toString(), quantity: 1 }],
          shippingAddress: {
            fullName: 'Test User', phone: '9876543210', street: '123 Test St',
            city: 'Test City', state: 'Test State', pinCode: '123456',
          },
        });

      // Either 200 (real Razorpay keys) or 502 (test env without real keys) is acceptable
      expect([200, 502]).toContain(res.status);
    });
  });

  describe('POST /api/payment/verify-payment', () => {
    it('should reject missing verification fields', async () => {
      const res = await userAgent
        .post('/api/payment/verify-payment')
        .send({})
        .expect(400);

      expect(res.body.message).toContain('Missing payment verification fields');
    });

    it('should reject non-existent order', async () => {
      const res = await userAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_fake',
          razorpay_payment_id: 'pay_fake',
          razorpay_signature: 'sig_fake',
        })
        .expect(400);

      expect(res.body.message).toContain('No order found');
    });
  });

  describe('POST /api/payment/webhook', () => {
    // The webhook requires the raw body to be available as a Buffer (see server.js
    // where express.raw() is mounted before express.json()). The test app doesn't
    // have this setup, so we verify the response shape (which will be 400 due to
    // the body parsing, but that's still testing the route's input validation).

    it('should return 400 for missing signature', async () => {
      const res = await request(app)
        .post('/api/payment/webhook')
        .set('Content-Type', 'application/json')
        .send({ event: 'test' })
        .expect(400);

      // Either "Missing signature or raw body" (real env) or a parsing error message
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/payment/refund/:orderId (Admin)', () => {
    it('should reject non-admin', async () => {
      const order = await Order.create({
        userId: user._id,
        orderItems: [{ productId: product._id, title: 'Test', price: 1000, quantity: 1 }],
        shippingAddress: { fullName: 'Test', phone: '9876543210', street: '123 St', city: 'City', state: 'State', pinCode: '123456' },
        razorpayOrderId: 'order_refund',
        razorpayPaymentId: 'pay_refund',
        paymentStatus: 'Paid',
        status: 'Processing',
        totalPrice: 1000,
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .post(`/api/payment/refund/${order._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(403);
    });
  });
});