const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Address = require('../models/Address');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createHashedUser = async ({ name, email, password, isAdmin = false, role = 'customer' }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin, role });
};

describe('Adversarial Security & RBAC Integrity Suite', () => {
  let customerAgent, adminAgent, customerUser, adminUser;

  beforeEach(async () => {
    customerAgent = request.agent(app);
    adminAgent = request.agent(app);

    // Allowlisted owner email in test env is admin@cartify.com (getAdminEmails())
    adminUser = await createHashedUser({
      name: 'Owner Admin',
      email: 'admin@cartify.com',
      password: 'Password123',
      isAdmin: true,
      role: 'admin',
    });

    customerUser = await createHashedUser({
      name: 'Legitimate Customer',
      email: 'customer@example.com',
      password: 'Password123',
      isAdmin: false,
      role: 'customer',
    });

    // Log in both agents
    await adminAgent.post('/api/auth/login').send({ email: 'admin@cartify.com', password: 'Password123' }).expect(200);
    await customerAgent.post('/api/auth/login').send({ email: 'customer@example.com', password: 'Password123' }).expect(200);
  });

  describe('1. Unauthenticated Requests', () => {
    it('should reject unauthenticated access to customer-protected routes', async () => {
      const anonAgent = request(app);
      const fakeId = new mongoose.Types.ObjectId();

      await anonAgent.get(`/api/orders/myorders/${fakeId}`).expect(401);
      await anonAgent.get('/api/cart').expect(401);
      await anonAgent.get(`/api/addresses/${fakeId}`).expect(401);
    });
  });

  describe('2. Role-Based Access Control (RBAC) & Privileged Endpoints', () => {
    it('should forbid customer from accessing admin staff management', async () => {
      await customerAgent.get('/api/admin/staff').expect(403);
    });

    it('should forbid customer from accessing admin audit logs', async () => {
      await customerAgent.get('/api/admin/audit-logs').expect(403);
    });

    it('should forbid customer from accessing delivery partners list', async () => {
      await customerAgent.get('/api/admin/delivery-partners').expect(403);
    });

    it('should forbid customer from uploading images', async () => {
      await customerAgent.post('/api/upload').expect(403);
    });
  });

  describe('3. Single-Owner Admin Policy Enforcement', () => {
    it('should reject creating staff with admin role for a non-owner email', async () => {
      const res = await adminAgent
        .post('/api/admin/staff')
        .send({
          name: 'Attacker Staff',
          email: 'hacker@malicious.com',
          password: 'Password123',
          role: 'admin',
        })
        .expect(403);

      expect(res.body.message).toContain('only allowlisted owner emails');
    });

    it('should reject promoting existing staff to admin for a non-owner email', async () => {
      // Create operational staff first
      const staffUser = await createHashedUser({
        name: 'Warehouse Worker',
        email: 'worker@cartify.com',
        password: 'Password123',
        role: 'customer_support',
      });

      const res = await adminAgent
        .patch(`/api/admin/staff/${staffUser._id}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(res.body.message).toContain('only allowlisted owner emails');
    });

    it('should reset isAdmin to false when staff is demoted to customer', async () => {
      const staffUser = await createHashedUser({
        name: 'Temp Privileged',
        email: 'temp@cartify.com',
        password: 'Password123',
        isAdmin: true,
        role: 'staff',
      });

      await adminAgent.delete(`/api/admin/staff/${staffUser._id}`).expect(200);

      const refreshed = await User.findById(staffUser._id);
      expect(refreshed.role).toBe('customer');
      expect(refreshed.isAdmin).toBe(false);
    });
  });

  describe('4. Insecure Direct Object Reference (IDOR) Protection', () => {
    let otherUser, otherAddress, otherOrder;

    beforeEach(async () => {
      otherUser = await createHashedUser({
        name: 'Victim User',
        email: 'victim@example.com',
        password: 'Password123',
      });

      otherAddress = await Address.create({
        userId: otherUser._id,
        fullName: 'Victim Name',
        phone: '9876543210',
        street: 'Victim Lane',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '110001',
      });

      otherOrder = await Order.create({
        userId: otherUser._id,
        orderItems: [],
        shippingAddress: {
          fullName: 'Victim',
          phone: '9876543210',
          street: 'Victim Lane',
          city: 'Delhi',
          state: 'Delhi',
          pinCode: '110001',
        },
        totalPrice: 1500,
        status: 'Processing',
        paymentStatus: 'Paid',
      });
    });

    it('should prevent customer from accessing another user addresses', async () => {
      await customerAgent.get(`/api/addresses/${otherUser._id}`).expect(403);
    });

    it('should prevent customer from deleting another user address', async () => {
      await customerAgent.delete(`/api/addresses/${otherAddress._id}`).expect(403);
    });

    it('should prevent customer from reading another user order', async () => {
      await customerAgent.get(`/api/orders/${otherOrder._id}`).expect(403);
    });

    it('should prevent customer from cancelling another user order', async () => {
      await customerAgent.post(`/api/orders/${otherOrder._id}/cancel`).expect(403);
    });
  });

  describe('5. Cart Payload Validation Integrity', () => {
    it('should reject non-array items payload on PUT /api/cart', async () => {
      const res = await customerAgent
        .put('/api/cart')
        .send({ items: 'not-an-array' })
        .expect(400);

      expect(res.body.message).toContain('items must be an array');
    });

    it('should reject non-array items payload on POST /api/cart/merge', async () => {
      const res = await customerAgent
        .post('/api/cart/merge')
        .send({ items: { foo: 'bar' } })
        .expect(400);

      expect(res.body.message).toContain('items must be an array');
    });
  });

  describe('6. Payment & Duplicate Refund Security', () => {
    it('should reject payment verification with forged signature', async () => {
      const res = await customerAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_test_123',
          razorpay_payment_id: 'pay_test_456',
          razorpay_signature: 'forged_fake_signature_hex_1234567890abcdef',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate refund on an order that already has a refundId', async () => {
      const refundedOrder = await Order.create({
        userId: customerUser._id,
        orderItems: [],
        shippingAddress: {
          fullName: 'Customer',
          phone: '9876543210',
          street: '123 St',
          city: 'City',
          state: 'State',
          pinCode: '110001',
        },
        razorpayOrderId: 'order_ref_123',
        razorpayPaymentId: 'pay_ref_456',
        refundId: 'rfnd_existing_999',
        paymentStatus: 'Refunded',
        status: 'Cancelled',
        totalPrice: 2000,
      });

      const res = await adminAgent
        .post(`/api/payment/refund/${refundedOrder._id}`)
        .expect(400);

      expect(res.body.message).toMatch(/Only paid orders|already been refunded/);
    });
  });

  describe('7. Order State Machine Transition Enforcement', () => {
    it('should reject illegal state transitions on PATCH /api/orders/:id/status', async () => {
      const cancelledOrder = await Order.create({
        userId: customerUser._id,
        orderItems: [],
        shippingAddress: {
          fullName: 'Customer',
          phone: '9876543210',
          street: '123 St',
          city: 'City',
          state: 'State',
          pinCode: '110001',
        },
        status: 'Cancelled',
        totalPrice: 1000,
      });

      // Terminal state Cancelled cannot transition to Confirmed
      const res = await adminAgent
        .patch(`/api/orders/${cancelledOrder._id}/status`)
        .send({ status: 'Confirmed' })
        .expect(400);

      expect(res.body.message).toContain('Cannot transition from Cancelled to Confirmed');
    });
  });
});
