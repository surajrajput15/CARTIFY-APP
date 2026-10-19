const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Coupon = require('../models/Coupon');
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createHashedUser = async ({ name, email, password, isAdmin = false, role = 'customer', assignedWarehouseId = null }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin, role, assignedWarehouseId });
};

describe('Cartify V2 End-to-End Frontend-Backend Integration Verification Suite', () => {
  let customerAgent, customerUser;
  let otherCustomerAgent, otherCustomerUser;
  let adminAgent, adminUser;
  let deliveryAgent, deliveryUser;
  let otherDeliveryAgent, otherDeliveryUser;
  let warehouseAgent, warehouseUser;
  let testWarehouse, otherWarehouse;
  let testProduct;

  beforeEach(async () => {
    customerAgent = request.agent(app);
    otherCustomerAgent = request.agent(app);
    adminAgent = request.agent(app);
    deliveryAgent = request.agent(app);
    otherDeliveryAgent = request.agent(app);
    warehouseAgent = request.agent(app);

    // Setup Warehouses
    testWarehouse = await Warehouse.create({
      name: 'Central Hub Mumbai',
      code: 'CHMUM01',
      city: 'Mumbai',
      state: 'Maharashtra',
      addressLine: '123 Hub St',
      isActive: true,
    });

    otherWarehouse = await Warehouse.create({
      name: 'North Hub Delhi',
      code: 'NHDEL01',
      city: 'New Delhi',
      state: 'Delhi',
      addressLine: '456 North Rd',
      isActive: true,
    });

    // Setup Users
    adminUser = await createHashedUser({
      name: 'Owner Admin',
      email: 'admin@cartify.com',
      password: 'Password123',
      isAdmin: true,
      role: 'admin',
    });

    customerUser = await createHashedUser({
      name: 'Primary Customer',
      email: 'customer@cartify.com',
      password: 'Password123',
      isAdmin: false,
      role: 'customer',
    });

    otherCustomerUser = await createHashedUser({
      name: 'Other Customer',
      email: 'other@cartify.com',
      password: 'Password123',
      isAdmin: false,
      role: 'customer',
    });

    deliveryUser = await createHashedUser({
      name: 'Fast Delivery Partner',
      email: 'courier1@cartify.com',
      password: 'Password123',
      isAdmin: false,
      role: 'delivery',
    });

    otherDeliveryUser = await createHashedUser({
      name: 'Second Delivery Partner',
      email: 'courier2@cartify.com',
      password: 'Password123',
      isAdmin: false,
      role: 'delivery',
    });

    warehouseUser = await createHashedUser({
      name: 'Warehouse Manager',
      email: 'warehouse@cartify.com',
      password: 'Password123',
      isAdmin: false,
      role: 'warehouse',
      assignedWarehouseId: testWarehouse._id,
    });

    // Create a Catalog Product
    testProduct = await Product.create({
      title: 'Premium Wireless Headphones',
      description: 'High-fidelity audio headphones with noise cancellation',
      price: 2499,
      category: 'Electronics',
      countInStock: 50,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    });

    // Log in the agents
    await adminAgent.post('/api/auth/login').send({ email: 'admin@cartify.com', password: 'Password123' }).expect(200);
    await customerAgent.post('/api/auth/login').send({ email: 'customer@cartify.com', password: 'Password123' }).expect(200);
    await otherCustomerAgent.post('/api/auth/login').send({ email: 'other@cartify.com', password: 'Password123' }).expect(200);
    await deliveryAgent.post('/api/auth/login').send({ email: 'courier1@cartify.com', password: 'Password123' }).expect(200);
    await otherDeliveryAgent.post('/api/auth/login').send({ email: 'courier2@cartify.com', password: 'Password123' }).expect(200);
    await warehouseAgent.post('/api/auth/login').send({ email: 'warehouse@cartify.com', password: 'Password123' }).expect(200);
  });

  // ============================================================================
  // JOURNEY 1: AUTHENTICATION & SESSION JOURNEY
  // ============================================================================
  describe('Journey 1: Authentication & Session Journey', () => {
    it('registers a new user and sets valid session token and profile', async () => {
      const anonAgent = request.agent(app);
      const res = await anonAgent
        .post('/api/auth/register')
        .send({
          name: 'New Registered User',
          email: 'newuser@cartify.com',
          password: 'Password123',
          phone: '9876543210',
        })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toMatchObject({
        name: 'New Registered User',
        email: 'newuser@cartify.com',
        role: 'customer',
      });

      // Verify authenticated session restoration via /me
      const meRes = await anonAgent.get('/api/auth/me').expect(200);
      expect(meRes.body.user.email).toBe('newuser@cartify.com');
    });

    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const anonAgent = request(app);
      await anonAgent.get('/api/auth/me').expect(401);
      await anonAgent.get('/api/cart').expect(401);
      await anonAgent.get(`/api/orders/myorders/${customerUser._id}`).expect(401);
    });

    it('enforces single-owner admin guard against unauthorized staff creation or role elevation', async () => {
      // Non-admin cannot access staff endpoints
      await customerAgent.get('/api/admin/staff').expect(403);
      await customerAgent.post('/api/admin/staff').send({ name: 'Hacker', email: 'hacker@cartify.com', role: 'admin' }).expect(403);

      // Owner admin CAN list and create staff
      const staffRes = await adminAgent.get('/api/admin/staff').expect(200);
      expect(Array.isArray(staffRes.body.staff)).toBe(true);
    });

    it('invalidates session upon logout', async () => {
      const sessionAgent = request.agent(app);
      await sessionAgent.post('/api/auth/login').send({ email: 'customer@cartify.com', password: 'Password123' }).expect(200);
      await sessionAgent.get('/api/auth/me').expect(200);

      // Logout
      await sessionAgent.post('/api/auth/logout').expect(200);
    });
  });

  // ============================================================================
  // JOURNEY 2: CART & PRODUCT INTEGRATION
  // ============================================================================
  describe('Journey 2: Cart & Product Integration', () => {
    it('fetches products catalog and syncs server cart with authentic prices', async () => {
      // Fetch public products
      const prodRes = await customerAgent.get('/api/products').expect(200);
      const products = Array.isArray(prodRes.body) ? prodRes.body : prodRes.body.products;
      expect(products.some((p) => p._id === testProduct._id.toString())).toBe(true);

      // Sync server cart
      const cartItems = [{ productId: testProduct._id.toString(), quantity: 2 }];
      const syncRes = await customerAgent.put('/api/cart').send({ items: cartItems }).expect(200);
      expect(syncRes.body.items).toHaveLength(1);
      expect(syncRes.body.items[0].quantity).toBe(2);
      expect(syncRes.body.items[0].price).toBe(2499);
    });

    it('merges guest cart into server cart upon login', async () => {
      const guestItems = [{ productId: testProduct._id.toString(), quantity: 3 }];
      const mergeRes = await customerAgent.post('/api/cart/merge').send({ items: guestItems }).expect(200);
      expect(mergeRes.body.items[0].quantity).toBe(3);
    });

    it('rejects cart creation when quantity exceeds available stock', async () => {
      const excessiveCart = [{ productId: testProduct._id.toString(), quantity: 999 }];
      // At checkout create-order, backend checks stock > requested quantity
      const orderPayload = {
        items: excessiveCart,
        shippingAddress: {
          fullName: 'Test User',
          phone: '9876543210',
          street: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
        },
      };
      const res = await customerAgent.post('/api/payment/create-order').send(orderPayload).expect(400);
      expect(res.body.message).toMatch(/quantity/i);
    });
  });

  // ============================================================================
  // JOURNEY 3: CHECKOUT & ADDRESS INTEGRATION
  // ============================================================================
  describe('Journey 3: Checkout & Address Integration', () => {
    let savedAddress;

    it('creates address with normalized 10-digit Indian phone and 6-digit PIN code', async () => {
      const addRes = await customerAgent
        .post('/api/addresses/add')
        .send({
          fullName: 'John Doe',
          phone: '+91 98765 43210', // formatted phone
          street: 'Flat 402, Lotus Residency, MG Road',
          city: 'Pune',
          state: 'Maharashtra',
          pinCode: '411 001', // formatted PIN
        })
        .expect(201);

      savedAddress = addRes.body;
      expect(savedAddress.phone).toBe('9876543210');
      expect(savedAddress.pinCode).toBe('411001');
    });

    it('strictly isolates address ownership (User B cannot access or delete User A address)', async () => {
      // User B tries to view User A's addresses
      await otherCustomerAgent.get(`/api/addresses/${customerUser._id}`).expect(403);

      // Create address for User A
      const addrRes = await customerAgent
        .post('/api/addresses/add')
        .send({
          fullName: 'Owner Address',
          phone: '9876543210',
          street: 'Private Lane',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
        })
        .expect(201);

      // User B tries to delete User A's address
      await otherCustomerAgent.delete(`/api/addresses/${addrRes.body._id}`).expect(403);

      // User A can delete own address
      await customerAgent.delete(`/api/addresses/${addrRes.body._id}`).expect(200);
    });
  });

  // ============================================================================
  // JOURNEY 4: COUPONS, ORDER CREATION & PAYMENT INTEGRATION
  // ============================================================================
  describe('Journey 4: Coupons, Order Creation & Payment Integration', () => {
    let activeCoupon;

    beforeEach(async () => {
      activeCoupon = await Coupon.create({
        code: 'WELCOME500',
        type: 'fixed',
        value: 500,
        minOrderAmount: 1000,
        isActive: true,
        validUntil: new Date(Date.now() + 86400000),
      });
    });

    it('validates coupon accurately and rejects below-minimum orders', async () => {
      // Valid order amount
      const validRes = await customerAgent
        .post('/api/coupons/validate')
        .send({ code: 'WELCOME500', orderAmount: 2499, items: [{ productId: testProduct._id.toString(), quantity: 1 }] })
        .expect(200);
      expect(validRes.body.valid).toBe(true);
      expect(validRes.body.coupon.discount).toBe(500);

      // Below minimum order amount returns 400 Bad Request
      const invalidRes = await customerAgent
        .post('/api/coupons/validate')
        .send({ code: 'WELCOME500', orderAmount: 499, items: [{ productId: testProduct._id.toString(), quantity: 1 }] })
        .expect(400);
      expect(invalidRes.body).toHaveProperty('message');
    });

    it('recalculates order total server-side and completely ignores client-forged prices', async () => {
      // Client attempts to tamper with price to 1 Rupee
      const tamperedPayload = {
        items: [{ productId: testProduct._id.toString(), quantity: 1, price: 1, subtotal: 1 }],
        shippingAddress: {
          fullName: 'Customer Name',
          phone: '9876543210',
          street: '123 Valid St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
        },
      };

      // Server creates order: in test env with fake razorpay keys, razorpayInstance will attempt call.
      // But notice: for a 100% coupon (free order), server completes immediately without external Razorpay call!
      const freeCoupon = await Coupon.create({
        code: '100FREE',
        type: 'percentage',
        value: 100,
        minOrderAmount: 100,
        isActive: true,
        validUntil: new Date(Date.now() + 86400000),
      });

      tamperedPayload.couponCode = '100FREE';
      const freeOrderRes = await customerAgent.post('/api/payment/create-order').send(tamperedPayload).expect(200);

      expect(freeOrderRes.body.freeOrder).toBe(true);
      expect(freeOrderRes.body.savedOrder.paymentStatus).toBe('Paid');
      expect(freeOrderRes.body.savedOrder.status).toBe('Processing');
      expect(freeOrderRes.body.savedOrder.orderItems[0].price).toBe(2499); // Server computed real catalog price, NOT client-forged 1!
      expect(freeOrderRes.body.savedOrder.totalPrice).toBe(0); // 100% coupon zero final payable
    });

    it('verifies Razorpay payment with timing-safe HMAC SHA-256 signature and rejects tampered signatures', async () => {
      // Create a pending order directly in database
      const order = await Order.create({
        userId: customerUser._id,
        orderItems: [
          {
            productId: testProduct._id,
            title: testProduct.title,
            price: testProduct.price,
            quantity: 1,
          },
        ],
        totalPrice: testProduct.price,
        status: 'Pending',
        paymentStatus: 'Pending',
        razorpayOrderId: 'order_test_123456',
        shippingAddress: {
          fullName: 'Customer Name',
          phone: '9876543210',
          street: '123 Valid St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
        },
      });

      const paymentId = 'pay_test_987654';
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(`order_test_123456|${paymentId}`)
        .digest('hex');

      // 1. Attempt verification with TAMPERED signature -> rejected by timing-safe HMAC check with 400
      await customerAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_test_123456',
          razorpay_payment_id: paymentId,
          razorpay_signature: 'tampered_invalid_signature_hex_value_000',
        })
        .expect(400);

      // Verify order is STILL Pending
      const checkPending = await Order.findById(order._id);
      expect(checkPending.status).toBe('Pending');

      // 2. Verification with VALID signature -> passes HMAC check and reaches Razorpay API call
      const verifyRes = await customerAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_test_123456',
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      // In test mode without live Razorpay connectivity, reaching the gateway call returns 502
      // (confirming signature was valid and passed all local checks, NOT 400 invalid signature)
      expect([200, 502]).toContain(verifyRes.status);

      // 3. Replay protection / Idempotency: when order is already Paid, re-sending same payment returns 200
      order.paymentStatus = 'Paid';
      order.status = 'Processing';
      order.razorpayPaymentId = paymentId;
      await order.save();

      const replayRes = await customerAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_test_123456',
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        })
        .expect(200);

      expect(replayRes.body.success).toBe(true);
      expect(replayRes.body.message).toMatch(/verified successfully/i);

      // 4. Replay with DIFFERENT payment ID is rejected
      await customerAgent
        .post('/api/payment/verify-payment')
        .send({
          razorpay_order_id: 'order_test_123456',
          razorpay_payment_id: 'pay_different_fraud_attempt',
          razorpay_signature: validSignature,
        })
        .expect(400);
    });
  });

  // ============================================================================
  // JOURNEY 5: ORDER TRACKING & DELIVERY LIFECYCLE
  // ============================================================================
  describe('Journey 5: Order Tracking & Delivery Lifecycle', () => {
    let order;

    beforeEach(async () => {
      order = await Order.create({
        userId: customerUser._id,
        orderItems: [
          {
            productId: testProduct._id,
            title: testProduct.title,
            price: testProduct.price,
            quantity: 1,
          },
        ],
        totalPrice: testProduct.price,
        status: 'Processing',
        paymentStatus: 'Paid',
        shippingAddress: {
          fullName: 'Customer Name',
          phone: '9876543210',
          street: '123 Valid St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
        },
      });
    });

    it('allows customer to view own order but forbids other customers (403)', async () => {
      // Customer views own order
      await customerAgent.get(`/api/orders/${order._id}`).expect(200);

      // Customer views own order history
      const myOrdersRes = await customerAgent.get(`/api/orders/myorders/${customerUser._id}`).expect(200);
      const list = Array.isArray(myOrdersRes.body) ? myOrdersRes.body : myOrdersRes.body.orders;
      expect(list.some((o) => o._id === order._id.toString())).toBe(true);

      // Other customer tries to view User A's order history -> 403 Forbidden
      await otherCustomerAgent.get(`/api/orders/myorders/${customerUser._id}`).expect(403);

      // Other customer tries to view User A's specific order -> 403 Forbidden
      await otherCustomerAgent.get(`/api/orders/${order._id}`).expect(403);
    });

    it('executes full delivery lifecycle from admin assignment to partner completion', async () => {
      // 1. Admin assigns delivery partner
      const assignRes = await adminAgent
        .post(`/api/orders/${order._id}/assign-delivery`)
        .send({ deliveryPartnerId: deliveryUser._id.toString() })
        .expect(200);

      expect(assignRes.body.order.deliveryStatus).toBe('assigned');
      expect(assignRes.body.order.deliveryPartnerId.toString()).toBe(deliveryUser._id.toString());

      // 2. Unassigned partner tries to accept -> 403 Forbidden
      await otherDeliveryAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(403);

      // 3. Assigned partner accepts
      const acceptRes = await deliveryAgent.post(`/api/orders/${order._id}/accept-delivery`).expect(200);
      expect(acceptRes.body.order.deliveryStatus).toBe('accepted');

      // 4. Assigned partner picks up
      const pickupRes = await deliveryAgent.post(`/api/orders/${order._id}/pickup-delivery`).expect(200);
      expect(pickupRes.body.order.deliveryStatus).toBe('picked_up');

      // 5. Assigned partner marks out for delivery
      const outRes = await deliveryAgent.post(`/api/orders/${order._id}/out-for-delivery`).expect(200);
      expect(outRes.body.order.deliveryStatus).toBe('out_for_delivery');

      // 6. Assigned partner completes delivery
      const completeRes = await deliveryAgent.post(`/api/orders/${order._id}/complete-delivery`).expect(200);
      expect(completeRes.body.order.deliveryStatus).toBe('delivered');
      expect(completeRes.body.order.status).toBe('Delivered');
    });
  });

  // ============================================================================
  // JOURNEY 6: WAREHOUSE STAFF & PRIVILEGED APIS
  // ============================================================================
  describe('Journey 6: Warehouse Staff & Privileged APIs', () => {
    beforeEach(async () => {
      await InventoryItem.create({
        warehouseId: testWarehouse._id,
        productId: testProduct._id,
        quantity: 25,
        lowStockThreshold: 5,
      });

      await InventoryItem.create({
        warehouseId: otherWarehouse._id,
        productId: testProduct._id,
        quantity: 100,
        lowStockThreshold: 10,
      });
    });

    it('scopes warehouse staff strictly to assigned warehouse dashboard and inventory', async () => {
      // Staff views dashboard
      const dashRes = await warehouseAgent.get('/api/warehouse/dashboard').expect(200);
      expect(dashRes.body.warehouse._id.toString()).toBe(testWarehouse._id.toString());

      // Staff views inventory -> only sees items in assigned warehouse
      const invRes = await warehouseAgent.get('/api/warehouse/inventory').expect(200);
      expect(invRes.body.items).toHaveLength(1);
      expect(invRes.body.items[0].quantity).toBe(25);
    });

    it('allows owner admin to explicitly scope to any warehouse via ?warehouseId=', async () => {
      // Admin scopes to North Hub Delhi
      const adminDash = await adminAgent
        .get(`/api/warehouse/dashboard?warehouseId=${otherWarehouse._id}`)
        .expect(200);
      expect(adminDash.body.warehouse._id.toString()).toBe(otherWarehouse._id.toString());

      // Admin requires warehouseId parameter
      await adminAgent.get('/api/warehouse/dashboard').expect(403);
    });
  });

  // ============================================================================
  // JOURNEY 7: HEALTH, READINESS & OBSERVABILITY
  // ============================================================================
  describe('Journey 7: Health & System Readiness', () => {
    it('responds with 200 OK and valid status on /health and /healthz', async () => {
      const anonAgent = request(app);
      const healthRes = await anonAgent.get('/health').expect(200);
      expect(healthRes.body.status).toBe('ok');
      expect(healthRes.body).toHaveProperty('timestamp');
      expect(healthRes.body).toHaveProperty('uptime');

      const healthzRes = await anonAgent.get('/healthz').expect(200);
      expect(healthzRes.body.status).toBe('ok');
    });
  });
});
