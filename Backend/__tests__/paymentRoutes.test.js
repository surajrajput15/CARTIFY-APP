const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const Product = require('../models/Product');
const Order = require('../models/Order');
const paymentRoutes = require('../routes/paymentRoutes');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'lax', secure: false } });
app.use((req, res, next) => {
  const excludedPaths = ['/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/google', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me', '/api/auth/csrf-token', '/api/payment/webhook'];
  if (excludedPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  csrfProtection(req, res, next);
});

app.use('/api/payment', paymentRoutes);

// Helper to get CSRF token from cookie
const getCsrfToken = async (agent) => {
  const res = await agent.get('/api/auth/csrf-token');
  const cookies = res.headers['set-cookie'];
  if (cookies) {
    const csrfCookie = cookies.find(c => c.startsWith('csrfToken='));
    if (csrfCookie) {
      return csrfCookie.split(';')[0].split('=')[1];
    }
  }
  return null;
};

describe('Payment Routes', () => {
  let userAgent, user, product;

  beforeEach(async () => {
    userAgent = request.agent(app);

    user = new User({ name: 'Test User', email: 'payment@test.com', password: 'Password123' });
    await user.save();
    await userAgent.post('/api/auth/login').send({ email: 'payment@test.com', password: 'Password123' });
    
    product = await Product.create({
      title: 'Test Product',
      price: 1000,
      description: 'Test',
      category: 'electronics',
      image: 'img.jpg',
      countInStock: 10
    });
  });

  describe('POST /api/payment/create-order', () => {
    it('should create order with valid items and address', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [{ productId: product._id.toString(), quantity: 1 }],
          shippingAddress: {
            fullName: 'Test User',
            phone: '9876543210',
            street: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            pinCode: '123456'
          }
        })
        .expect(200);

      expect(res.body.order).toBeDefined();
      expect(res.body.order.amount).toBe(100000);
      expect(res.body.order.currency).toBe('INR');
      expect(res.body.orderId).toBeDefined();
    });

    it('should reject empty items array', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/payment/create-order')
        .set('X-CSRF-Token', csrfToken)
        .send({
          items: [],
          shippingAddress: {
            fullName: 'Test',
            phone: '9876543210',
            street: '123 St',
            city: 'City',
            state: 'State',
            pinCode: '123456'
          }
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
          shippingAddress: { fullName: 'Test' }
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
            fullName: 'Test',
            phone: '9876543210',
            street: '123 St',
            city: 'City',
            state: 'State',
            pinCode: '123456'
          }
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
            fullName: 'Test',
            phone: '9876543210',
            street: '123 St',
            city: 'City',
            state: 'State',
            pinCode: '123456'
          }
        })
        .expect(400);

      expect(res.body.message).toContain('Some products do not exist');
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
          razorpay_signature: 'sig_fake'
        })
        .expect(400);

      expect(res.body.message).toContain('No order found');
    });
  });

  describe('POST /api/payment/webhook', () => {
    it('should reject missing signature', async () => {
      const res = await request(app)
        .post('/api/payment/webhook')
        .send({ event: 'test' })
        .expect(400);

      expect(res.body.message).toContain('Missing signature or raw body');
    });

    it('should reject invalid signature', async () => {
      const res = await request(app)
        .post('/api/payment/webhook')
        .set('x-razorpay-signature', 'invalid_sig')
        .send(Buffer.from('{}'))
        .expect(400);

      expect(res.body.message).toContain('Invalid signature');
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
        totalPrice: 1000
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .post(`/api/payment/refund/${order._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(403);
    });
  });
});