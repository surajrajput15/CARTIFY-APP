const request = require('supertest');
const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const User = require('../models/User');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const PASSWORD = 'Password123';

// Helper: create an account with a hashed password and the requested role.
const createAccount = async ({ name, email, role = 'customer', isAdmin = false, phone = null }) => {
  const password = await bcrypt.hash(PASSWORD, 10);
  return User.create({ name, email, password, role, isAdmin, phone });
};

const login = async (agent, email) => {
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res;
};

let orderSeq = 0;
const baseOrder = (overrides = {}) => ({
  orderItems: [{ productId: '507f1f77bcf86cd799439011', title: 'Test Item', price: 100, quantity: 1 }],
  shippingAddress: {
    fullName: 'Test User',
    phone: '9876543210',
    street: '123 St',
    city: 'City',
    state: 'State',
    pinCode: '123456',
    latitude: 19.076,
    longitude: 72.8777,
  },
  razorpayOrderId: `order_delivery_${++orderSeq}`,
  paymentStatus: 'Paid',
  status: 'Processing',
  totalPrice: 100,
  ...overrides,
});

describe('Order Delivery Routes (Phase 1)', () => {
  let customerAgent, adminAgent, partnerAgent, otherPartnerAgent;
  let customer, adminUser, partner, otherPartner;

  beforeEach(async () => {
    customerAgent = request.agent(app);
    adminAgent = request.agent(app);
    partnerAgent = request.agent(app);
    otherPartnerAgent = request.agent(app);

    customer = await createAccount({ name: 'Customer', email: 'customer@test.com' });
    await login(customerAgent, 'customer@test.com');

    adminUser = await createAccount({ name: 'Admin', email: 'admin@test.com', isAdmin: true });
    await login(adminAgent, 'admin@test.com');

    partner = await createAccount({ name: 'Partner One', email: 'partner1@test.com', role: 'delivery', phone: '9876543210' });
    await login(partnerAgent, 'partner1@test.com');

    otherPartner = await createAccount({ name: 'Partner Two', email: 'partner2@test.com', role: 'delivery' });
    await login(otherPartnerAgent, 'partner2@test.com');
  });

  // ------------------------------------------------------------------ assign
  describe('POST /api/orders/:id/assign-delivery', () => {
    it('lets an admin assign a delivery partner', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));

      const res = await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: partner._id.toString() })
        .expect(200);

      expect(res.body.message).toMatch(/assigned/i);
      expect(res.body.order.deliveryStatus).toBe('assigned');
      expect(res.body.order.deliveryPartnerId.toString()).toBe(partner._id.toString());
      expect(res.body.order.assignedAt).toBeTruthy();
    });

    it('rejects a non-admin caller', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      await customerAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: partner._id.toString() })
        .expect(403);
    });

    it('rejects a delivery partner caller (admin only)', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      await partnerAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: partner._id.toString() })
        .expect(403);
    });

    it('requires deliveryPartnerId', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      const res = await adminAgent.post(`/api/orders/${order._id}/assign-delivery`).send({}).expect(400);
      expect(res.body.message).toMatch(/deliveryPartnerId is required/i);
    });

    it('rejects a malformed deliveryPartnerId', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      const res = await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: 'not-an-object-id' })
        .expect(400);
      expect(res.body.message).toMatch(/invalid delivery partner id/i);
    });

    it('rejects a user that does not have the delivery role', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      const res = await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: customer._id.toString() })
        .expect(400);
      expect(res.body.message).toMatch(/not a delivery partner/i);
    });

    it('404s for an unknown delivery partner', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: '507f1f77bcf86cd799439099' })
        .expect(404);
    });

    it('404s for an unknown order', async () => {
      await adminAgent
        .post('/api/orders/507f1f77bcf86cd799439098/assign-delivery')
        .send({ deliveryPartnerId: partner._id.toString() })
        .expect(404);
    });

    it('rejects an order whose delivery already completed', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
      }));

      const res = await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: otherPartner._id.toString() })
        .expect(400);
      expect(res.body.message).toMatch(/completed or cancelled/i);
    });
  });

  // ------------------------------------------------------------------ accept
  describe('POST /api/orders/:id/accept-delivery', () => {
    it('lets the assigned partner accept the job', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
        assignedAt: new Date(),
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('accepted');
      expect(res.body.order.acceptedAt).toBeTruthy();
    });

    it('rejects a partner who is not assigned to the order', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
      }));

      const res = await otherPartnerAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(403);
      expect(res.body.message).toMatch(/not assigned to this order/i);
    });

    it('rejects the customer role', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
      }));
      await customerAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(403);
    });

    it('lets the owner admin accept another partner\'s job', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
        assignedAt: new Date(),
      }));

      const res = await adminAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('accepted');
    });

    it('rejects an illegal transition (already picked up)', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'picked_up',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(400);
      expect(res.body.message).toMatch(/cannot accept delivery in current status/i);
    });

    it('rejects an order with no assigned partner', async () => {
      const order = await Order.create(baseOrder({ userId: customer._id }));
      await partnerAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(400);
    });
  });

  // ------------------------------------------------------------------ pickup
  describe('POST /api/orders/:id/pickup-delivery', () => {
    it('moves an accepted delivery to picked_up', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'accepted',
        acceptedAt: new Date(),
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/pickup-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('picked_up');
      expect(res.body.order.pickedUpAt).toBeTruthy();
    });

    it('rejects pickup before the partner accepted', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/pickup-delivery`).expect(400);
      expect(res.body.message).toMatch(/cannot pick up/i);
    });

    it('rejects a different partner', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'accepted',
      }));
      await otherPartnerAgent.post(`/api/orders/${order._id}/pickup-delivery`).expect(403);
    });
  });

  // ---------------------------------------------------------- out-for-delivery
  describe('POST /api/orders/:id/out-for-delivery', () => {
    it('flags the order out for delivery and advances the order status from Processing', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'picked_up',
        status: 'Processing',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/out-for-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('out_for_delivery');
      expect(res.body.order.outForDeliveryAt).toBeTruthy();
      expect(res.body.order.status).toBe('Out for Delivery');
    });

    it('advances the order status from Packed as well', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'picked_up',
        status: 'Packed',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/out-for-delivery`).expect(200);
      expect(res.body.order.status).toBe('Out for Delivery');
    });

    it('rejects the step when the parcel was never picked up', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'accepted',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/out-for-delivery`).expect(400);
      expect(res.body.message).toMatch(/cannot go out for delivery/i);
    });
  });

  // ---------------------------------------------------------------- complete
  describe('POST /api/orders/:id/complete-delivery', () => {
    it('marks the order delivered and settles a pending payment', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'out_for_delivery',
        status: 'Out for Delivery',
        paymentStatus: 'Pending',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/complete-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('delivered');
      expect(res.body.order.deliveredAt).toBeTruthy();
      expect(res.body.order.status).toBe('Delivered');
      expect(res.body.order.paymentStatus).toBe('Paid');
      expect(res.body.order.paidAt).toBeTruthy();
    });

    it('leaves an already-paid order untouched', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'out_for_delivery',
        status: 'Out for Delivery',
        paymentStatus: 'Paid',
        paidAt: new Date('2026-01-01T00:00:00.000Z'),
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/complete-delivery`).expect(200);
      expect(res.body.order.paymentStatus).toBe('Paid');
      expect(new Date(res.body.order.paidAt).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('rejects completion before the parcel left for delivery', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'picked_up',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/complete-delivery`).expect(400);
      expect(res.body.message).toMatch(/cannot complete delivery/i);
    });

    it('rejects a partner who is not assigned', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'out_for_delivery',
      }));
      await otherPartnerAgent.post(`/api/orders/${order._id}/complete-delivery`).expect(403);
    });
  });

  // -------------------------------------------------------------------- fail
  describe('POST /api/orders/:id/fail-delivery', () => {
    it('fails an out-for-delivery job and marks the order Failed', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'out_for_delivery',
        status: 'Out for Delivery',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/fail-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('failed');
      expect(res.body.order.failedAt).toBeTruthy();
      expect(res.body.order.status).toBe('Failed');
      expect(res.body.orderCancellable).toBe(false);
    });

    it('allows failure straight after assignment and reports the order as still cancellable', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
        status: 'Processing',
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/fail-delivery`).expect(200);
      expect(res.body.order.deliveryStatus).toBe('failed');
      expect(res.body.order.status).toBe('Failed');
      expect(res.body.orderCancellable).toBe(true);
    });

    it('rejects failure once the delivery already completed', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'delivered',
        status: 'Delivered',
        deliveredAt: new Date(),
      }));

      const res = await partnerAgent.post(`/api/orders/${order._id}/fail-delivery`).expect(400);
      expect(res.body.message).toMatch(/cannot fail delivery/i);
    });

    it('rejects the customer role', async () => {
      const order = await Order.create(baseOrder({
        userId: customer._id,
        deliveryPartnerId: partner._id,
        deliveryStatus: 'assigned',
      }));
      await customerAgent.post(`/api/orders/${order._id}/fail-delivery`).expect(403);
    });
  });

  // --------------------------------------------------------- GET /delivery/*
  describe('GET /api/orders/delivery/assigned', () => {
    it('returns only this partner\'s active deliveries', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'out_for_delivery', status: 'Out for Delivery' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: new Date() }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'failed', status: 'Failed', failedAt: new Date() }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'assigned', status: 'Processing' }),
      ]);

      const res = await partnerAgent.get('/api/orders/delivery/assigned').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.orders).toHaveLength(2);
      const active = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];
      expect(res.body.orders.every((o) => active.includes(o.deliveryStatus))).toBe(true);
      expect(res.body.orders.every((o) => o.deliveryPartnerId._id === partner._id.toString())).toBe(true);
      expect(res.body.orders[0].deliveryPartnerId.name).toBe('Partner One');
    });

    it('rejects a non-delivery caller', async () => {
      await customerAgent.get('/api/orders/delivery/assigned').expect(403);
    });

    it('lets the owner admin see every partner\'s active jobs', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'accepted', status: 'Processing' }),
      ]);

      const res = await adminAgent.get('/api/orders/delivery/assigned').expect(200);
      expect(res.body.total).toBe(2);
      const partnerIds = res.body.orders.map((o) => o.deliveryPartnerId._id);
      expect(partnerIds).toContain(partner._id.toString());
      expect(partnerIds).toContain(otherPartner._id.toString());
    });
  });

  describe('GET /api/orders/delivery/completed', () => {
    it('returns delivered jobs newest first with pagination metadata', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: new Date('2026-01-01T00:00:00.000Z') }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: new Date('2026-02-01T00:00:00.000Z') }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: new Date() }),
      ]);

      const res = await partnerAgent.get('/api/orders/delivery/completed').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pages).toBe(1);
      expect(res.body.orders[0].deliveredAt).toContain('2026-02-01');
    });

    it('rejects a non-delivery caller', async () => {
      await customerAgent.get('/api/orders/delivery/completed').expect(403);
    });
  });

  describe('GET /api/orders/delivery/failed', () => {
    it('returns only this partner\'s failed jobs', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'failed', status: 'Failed', failedAt: new Date() }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'failed', status: 'Failed', failedAt: new Date() }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
      ]);

      const res = await partnerAgent.get('/api/orders/delivery/failed').expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.orders[0].deliveryStatus).toBe('failed');
      expect(res.body.orders[0].deliveryPartnerId._id).toBe(partner._id.toString());
    });

    it('rejects a non-delivery caller', async () => {
      await customerAgent.get('/api/orders/delivery/failed').expect(403);
    });
  });

  describe('GET /api/orders/delivery/stats', () => {
    it('returns this partner\'s headline numbers scoped to today', async () => {
      const today = new Date();
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await Order.insertMany([
        // Active & in-flight — counted.
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'picked_up', status: 'Processing' }),
        // Delivered today vs delivered long ago.
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: today }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: longAgo }),
        // Failed today.
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'failed', status: 'Failed', failedAt: today }),
        // Someone else's job — never counted.
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'assigned', status: 'Processing' }),
      ]);

      const res = await partnerAgent.get('/api/orders/delivery/stats').expect(200);
      expect(res.body.active).toBe(2);
      expect(res.body.todayCompleted).toBe(1);
      expect(res.body.todayFailed).toBe(1);
      expect(res.body.todayTotal).toBe(2);
      expect(res.body.weekCompleted).toBeGreaterThanOrEqual(1);
    });

    it('rejects a non-delivery caller', async () => {
      await customerAgent.get('/api/orders/delivery/stats').expect(403);
    });

    it('aggregates every partner for the owner admin', async () => {
      const today = new Date();
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'picked_up', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: today }),
      ]);

      const res = await adminAgent.get('/api/orders/delivery/stats').expect(200);
      expect(res.body.active).toBe(2);
      expect(res.body.todayCompleted).toBe(1);
      expect(res.body.todayTotal).toBe(1);
    });
  });

  describe('GET /api/orders/admin/delivery', () => {
    it('lets an admin list every order with delivery info', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryStatus: 'not_assigned', status: 'Pending' }),
      ]);

      const res = await adminAgent.get('/api/orders/admin/delivery').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.orders).toHaveLength(2);

      const assigned = res.body.orders.find((o) => o.deliveryStatus === 'assigned');
      expect(assigned.deliveryPartnerId.name).toBe('Partner One');
      expect(assigned.deliveryPartnerId.phone).toBe('9876543210');
    });

    it('filters by deliveryStatus', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'delivered', status: 'Delivered', deliveredAt: new Date() }),
      ]);

      const res = await adminAgent.get('/api/orders/admin/delivery?deliveryStatus=delivered').expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.orders[0].deliveryStatus).toBe('delivered');
    });

    it('filters by deliveryPartnerId', async () => {
      await Order.insertMany([
        baseOrder({ userId: customer._id, deliveryPartnerId: partner._id, deliveryStatus: 'assigned', status: 'Processing' }),
        baseOrder({ userId: customer._id, deliveryPartnerId: otherPartner._id, deliveryStatus: 'assigned', status: 'Processing' }),
      ]);

      const res = await adminAgent
        .get(`/api/orders/admin/delivery?deliveryPartnerId=${otherPartner._id}`)
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.orders[0].deliveryPartnerId._id).toBe(otherPartner._id.toString());
    });

    it('rejects a malformed deliveryPartnerId filter', async () => {
      const res = await adminAgent.get('/api/orders/admin/delivery?deliveryPartnerId=abc').expect(400);
      expect(res.body.message).toMatch(/invalid delivery partner id/i);
    });

    it('rejects a non-admin caller', async () => {
      await customerAgent.get('/api/orders/admin/delivery').expect(403);
      await partnerAgent.get('/api/orders/admin/delivery').expect(403);
    });
  });
});
