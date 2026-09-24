const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Campaign = require('../models/Campaign');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ email, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash('Password123', 10);
  return User.create({ name: 'T', email, password: hashedPassword, isAdmin });
};

const validCampaign = (overrides = {}) => ({
  name: 'Diwali Sale',
  discountType: 'percentage',
  discountValue: 10,
  startDate: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  ...overrides,
});

describe('Festival Campaigns', () => {
  let adminAgent, userAgent, admin, user, product, clothingProduct;

  beforeEach(async () => {
    await Promise.all([Campaign.deleteMany({}), User.deleteMany({}), Product.deleteMany({})]);

    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    admin = await createTestUser({ email: `cmp${Date.now()}a@t.com`, isAdmin: true });
    user = await createTestUser({ email: `cmp${Date.now()}u@t.com` });

    await adminAgent.post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: user.email, password: 'Password123' });

    product = await Product.create({
      title: 'Blender', price: 3000, description: 'T', category: 'home', image: 'b.jpg', countInStock: 5,
    });
    clothingProduct = await Product.create({
      title: 'Hoodie', price: 2000, description: 'T', category: 'clothing', image: 'h.jpg', countInStock: 5,
    });
  });

  describe('campaign CRUD', () => {
    it('rejects non-admins', async () => {
      const res = await userAgent.post('/api/campaigns').send(validCampaign());
      expect(res.status).toBe(403);
    });

    it('creates, lists, patches and deletes', async () => {
      const created = await adminAgent.post('/api/campaigns').send(validCampaign());
      expect(created.status).toBe(201);
      const cId = created.body.campaign._id;

      const list = await adminAgent.get('/api/campaigns');
      expect(list.status).toBe(200);
      expect(list.body.campaigns).toHaveLength(1);
      expect(list.body.campaigns[0].discountValue).toBe(10);

      const patched = await adminAgent.patch(`/api/campaigns/${cId}`).send({ discountValue: 15 });
      expect(patched.status).toBe(200);
      expect(patched.body.campaign.discountValue).toBe(15);

      const toggled = await adminAgent.patch(`/api/campaigns/${cId}/toggle`);
      expect(toggled.status).toBe(200);
      expect(toggled.body.campaign.isActive).toBe(false);

      const removed = await adminAgent.delete(`/api/campaigns/${cId}`);
      expect(removed.status).toBe(200);
    });

    it('rejects invalid payloads', async () => {
      const res = await adminAgent.post('/api/campaigns').send({ name: 'X', discountType: 'bogus' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/discountType|startDate|endDate/);

      const rev = await adminAgent.post('/api/campaigns').send(validCampaign({
        startDate: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        endDate: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      }));
      expect(rev.status).toBe(400);
    });
  });

  describe('public active + price endpoints', () => {
    it('only exposes live campaigns without admin hidden fields', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign());
      // future campaign -> not live
      await adminAgent.post('/api/campaigns').send(validCampaign({
        name: 'Future',
        startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 50).toISOString(),
      }));

      const res = await request(app).get('/api/campaigns/active');
      expect(res.status).toBe(200);
      expect(res.body.campaigns).toHaveLength(1);
      expect(res.body.campaigns[0]).not.toHaveProperty('createdBy');
      expect(res.body.campaigns[0].name).toBe('Diwali Sale');
    });

    it('computes discounted price for eligible product', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign()); // 10% off everything
      const res = await request(app).get(`/api/campaigns/active/price/${product._id}?price=3000`);
      expect(res.status).toBe(200);
      expect(res.body.discountedPrice).toBe(2700);
      expect(res.body.lineDiscount).toBe(300);
      expect(res.body.campaign.discountValue).toBe(10);
    });

    it('scope: category-limited campaign does not hit other categories', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({ eligibleCategories: ['clothing'] }));
      const resHome = await request(app).get(`/api/campaigns/active/price/${product._id}?price=3000`);
      expect(resHome.body.lineDiscount).toBe(0);
      const resClothing = await request(app).get(`/api/campaigns/active/price/${clothingProduct._id}?price=2000`);
      expect(resClothing.body.discountedPrice).toBe(1800);
    });
  });

  describe('engine (unit)', () => {
    it('picks the single best campaign by discount amount', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({ name: 'Ten', discountValue: 10 }));
      await adminAgent.post('/api/campaigns').send(validCampaign({ name: 'Twenty', discountValue: 20 }));
      const { findBestCampaignForCart } = require('../utils/campaignEngine');
      const best = await findBestCampaignForCart({
        items: [{ productId: product._id, quantity: 1, price: 1000, category: 'home' }],
      });
      expect(best.campaign.name).toBe('Twenty');
      expect(best.discountPaise).toBe(20000); // 20% of 1000
    });

    it('fixed campaign applies once; percentage respects maxDiscount cap', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({
        name: 'Flat500', discountType: 'fixed', discountValue: 500,
      }));
      const { applyCampaignAtCheckout } = require('../utils/campaignEngine');
      const fixed = await applyCampaignAtCheckout({
        cartTotalRupees: 3000,
        items: [{ productId: product._id, quantity: 2, price: 1500, category: 'home' }],
      });
      expect(fixed.discount).toBe(500);
      expect(fixed.finalAmount).toBe(2500);

      await Campaign.updateOne({ name: 'Flat500' }, { discountType: 'percentage', discountValue: 50, maxDiscount: 300 });
      const capped = await applyCampaignAtCheckout({
        cartTotalRupees: 3000,
        items: [{ productId: product._id, quantity: 1, price: 3000, category: 'home' }],
      });
      expect(capped.discount).toBe(300); // capped, not 1500
    });

    it('inactive or out-of-window campaigns never apply', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({
        name: 'Soon', startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 20).toISOString(),
      }));
      const { applyCampaignAtCheckout } = require('../utils/campaignEngine');
      const res = await applyCampaignAtCheckout({
        cartTotalRupees: 1000,
        items: [{ productId: product._id, quantity: 1, price: 1000, category: 'home' }],
      });
      expect(res.applied).toBe(false);
      expect(res.discount).toBe(0);
    });
  });

  describe('checkout integration in payment routes', () => {
    // Uses a 100% campaign so the order total becomes 0 and takes the
    // free-order path — that bypasses Razorpay, letting us verify campaign
    // fields actually persist on the Order without live gateway keys.
    it('a live campaign auto-applies to eligible items at create-order', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({ discountValue: 100 }));
      const res = await userAgent.post('/api/payment/create-order').send({
        items: [{ productId: product._id, quantity: 1, price: 3000 }],
        shippingAddress: {
          fullName: 'QA', phone: '9123456780', street: 'X', city: 'Delhi', state: 'DL', pinCode: '110001',
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.freeOrder).toBe(true);
      expect(res.body.savedOrder.campaignSnapshot?.name).toBe('Diwali Sale');
      expect(res.body.savedOrder.campaignDiscountAmount).toBe(3000);
      expect(res.body.savedOrder.originalTotal).toBe(3000);
      expect(res.body.savedOrder.totalPrice).toBe(0);
      // campaign and coupon never both set
      expect(res.body.savedOrder.couponCode).toBeNull();
    });

    it('invalid coupon still hard-fails even with a live campaign', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign());
      const res = await userAgent.post('/api/payment/create-order').send({
        items: [{ productId: product._id, quantity: 1, price: 3000 }],
        shippingAddress: {
          fullName: 'QA', phone: '9123456780', street: 'X', city: 'Delhi', state: 'DL', pinCode: '110001',
        },
        couponCode: 'NOPE',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid coupon/i);
    });

    it('expired campaign does not discount', async () => {
      await adminAgent.post('/api/campaigns').send(validCampaign({
        startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() - 86400000 * 1).toISOString(),
      }));
      // expired: no live campaign -> cart total stays 3000 -> Razorpay path in
      // test env (no keys) returns 502, but the request must NOT be free.
      const res = await userAgent.post('/api/payment/create-order').send({
        items: [{ productId: product._id, quantity: 1, price: 3000 }],
        shippingAddress: {
          fullName: 'QA', phone: '9123456780', street: 'X', city: 'Delhi', state: 'DL', pinCode: '110001',
        },
      });
      expect(res.body.freeOrder).toBeFalsy();
      expect([200, 502]).toContain(res.status);
    });
  });
});