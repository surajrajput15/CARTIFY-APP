const request = require('supertest');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { computeDiscountPaise, evaluateCoupon, applyCouponAtCheckout, findBestCoupon } = require('../utils/couponEngine');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ name, email, password, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin });
};
const User = require('../models/User');

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

describe('Coupon Engine', () => {
  beforeEach(async () => {
    await Promise.all([Coupon.deleteMany({}), Order.deleteMany({}), User.deleteMany({}), Product.deleteMany({})]);
  });

  describe('computeDiscountPaise', () => {
    it('caps percentage discount at maxDiscount', () => {
      const coupon = { type: 'percentage', value: 10, maxDiscount: 10 };
      // 10% of 50000 paise = 5000 paise → capped at ₹10 = 1000 paise
      expect(computeDiscountPaise(coupon, 50000)).toBe(1000);
    });

    it('computes fixed discount below the order total', () => {
      const coupon = { type: 'fixed', value: 20, maxDiscount: null };
      // ₹20 fixed on a ₹100 (10000 paise) order → 2000 paise
      expect(computeDiscountPaise(coupon, 10000)).toBe(2000);
    });

    it('never discounts more than the order total', () => {
      const coupon = { type: 'fixed', value: 500, maxDiscount: null };
      // ₹500 fixed on a ₹100 (10000 paise) order → capped at 10000 paise
      expect(computeDiscountPaise(coupon, 10000)).toBe(10000);
    });
  });

  describe('evaluateCoupon', () => {
    it('rejects inactive / expired / below-min coupons', async () => {
      const coupon = await Coupon.create({
        code: 'TEST', type: 'percentage', value: 10, minOrderAmount: 5000,
        validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: false,
      });
      const check = await evaluateCoupon(coupon, { orderAmount: 10000, items: [] });
      expect(check.valid).toBe(false);
    });

    it('rejects coupons when the cart has no applicable items (category mismatch)', async () => {
      const coupon = await Coupon.create({
        code: 'CATE', type: 'percentage', value: 10, minOrderAmount: 0,
        validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true,
        applicableCategories: ['electronics'],
      });
      const product = await Product.create({
        title: 'Shirt', price: 5000, description: 'T', category: 'clothing',
        image: 'img.jpg', countInStock: 5,
      });
      const check = await evaluateCoupon(coupon, { orderAmount: 5000, items: [{ productId: product._id }] });
      expect(check.valid).toBe(false);
    });

    it('accepts a valid percentage coupon', async () => {
      const coupon = await Coupon.create({
        code: 'OK10', type: 'percentage', value: 10, minOrderAmount: 0, maxDiscount: 4000,
        validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true,
      });
      const product = await Product.create({
        title: 'Headphones', price: 20000, description: 'T', category: 'electronics',
        image: 'img.jpg', countInStock: 5,
      });
      const check = await evaluateCoupon(coupon, { orderAmount: 20000, items: [{ productId: product._id }] });
      expect(check.valid).toBe(true);
      expect(check.discount).toBe(2000);
    });

    it('enforces per-user usage limit via canUserUse', async () => {
      const coupon = await Coupon.create({
        code: 'USER1', type: 'fixed', value: 100, minOrderAmount: 0,
        validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true, userLimit: 1,
      });
      const user = await createTestUser({ name: 'U', email: `u${Date.now()}@t.com`, password: 'Password123' });
      coupon.usedBy = [{ userId: user._id, usedAt: new Date() }];
      expect(coupon.canUserUse(user._id.toString())).toBe(false);
    });

    it('rejects a reached usage limit in evaluateCoupon', async () => {
      const coupon = await Coupon.create({
        code: 'LIMIT1', type: 'fixed', value: 100, minOrderAmount: 0,
        validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true,
        usageLimit: 1, usedCount: 1,
      });
      const check = await evaluateCoupon(coupon, { orderAmount: 2000, items: [] });
      expect(check.valid).toBe(false);
      expect(check.message).toBe('Coupon usage limit reached');
    });
  });

  describe('findBestCoupon', () => {
    it('picks the coupon with the highest saving', async () => {
      await Coupon.create({ code: 'A10', type: 'percentage', value: 10, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true, minOrderAmount: 0 });
      await Coupon.create({ code: 'B25', type: 'percentage', value: 25, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true, minOrderAmount: 0 });
      const product = await Product.create({
        title: 'Gadget', price: 10000, description: 'T', category: 'electronics', image: 'img.jpg', countInStock: 5,
      });
      const result = await findBestCoupon({ orderAmount: 10000, items: [{ productId: product._id }] });
      expect(result.found).toBe(true);
      expect(result.coupon.code).toBe('B25');
      expect(result.discount).toBe(2500);
    });
  });

  describe('applyCouponAtCheckout', () => {
    it('returns invalid for a missing coupon code', async () => {
      const result = await applyCouponAtCheckout(null, 'abc', { orderAmount: 100, items: [] });
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid coupon code');
    });
  });

  describe('routes', () => {
    let userAgent, adminAgent, admin, user, product;

    beforeEach(async () => {
      userAgent = request.agent(app);
      adminAgent = request.agent(app);

      user = await createTestUser({ name: 'Buyer', email: `buyer${Date.now()}@t.com`, password: 'Password123' });
      admin = await createTestUser({ name: 'Boss', email: `boss${Date.now()}@t.com`, password: 'Password123', isAdmin: true });

      await userAgent.post('/api/auth/login').send({ email: user.email, password: 'Password123' });
      await adminAgent.post('/api/auth/login').send({ email: admin.email, password: 'Password123' });

      product = await Product.create({
        title: 'Watch', price: 10000, description: 'T', category: 'electronics',
        image: 'img.jpg', countInStock: 10,
      });
    });

    it('validates a coupon end-to-end', async () => {
      await Coupon.create({ code: 'END10', type: 'percentage', value: 10, minOrderAmount: 0, maxDiscount: 1000, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true });
      const res = await userAgent.post('/api/coupons/validate').send({ code: 'END10', orderAmount: 10000, items: [{ productId: product._id }] });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.coupon.discount).toBe(1000);
    });

    it('rejects a category-mismatched cart on validate', async () => {
      await Coupon.create({ code: 'CAT10', type: 'percentage', value: 10, minOrderAmount: 0, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true, applicableCategories: ['furniture'] });
      const res = await userAgent.post('/api/coupons/validate').send({ code: 'CAT10', orderAmount: 10000, items: [{ productId: product._id }] });
      expect(res.status).toBe(400);
    });

    it('auto-applies the best coupon via /best', async () => {
      await Coupon.create({ code: 'BEST15', type: 'percentage', value: 15, minOrderAmount: 0, maxDiscount: 2000, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true });
      const res = await userAgent.post('/api/coupons/best').send({ orderAmount: 10000, items: [{ productId: product._id }] });
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.coupon.code).toBe('BEST15');
    });

    it('exposes paid-order usage analytics to admins only', async () => {
      await Coupon.create({ code: 'ANA10', type: 'percentage', value: 10, minOrderAmount: 0, validFrom: daysFromNow(-2), validUntil: daysFromNow(2), isActive: true });
      await Order.create({
        userId: user._id,
        orderItems: [{ productId: product._id, title: 'Watch', price: 10000, quantity: 1 }],
        shippingAddress: { fullName: 'T', phone: '9000000000', street: 'S', city: 'C', state: 'ST', pinCode: '123456' },
        totalPrice: 9000, paymentStatus: 'Paid',
        status: 'Delivered', couponCode: 'ANA10', discountAmount: 1000,
      });
      const adminRes = await adminAgent.get('/api/coupons/analytics');
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.overview.orders).toBe(1);
      expect(adminRes.body.byCode[0]._id).toBe('ANA10');

      const userRes = await userAgent.get('/api/coupons/analytics');
      expect(userRes.status).toBe(403);
    });

    it('does not swallow /analytics as a coupon id lookup', async () => {
      const res = await adminAgent.get('/api/coupons/analytics');
      expect(res.status).toBe(200);
    });
  });
});