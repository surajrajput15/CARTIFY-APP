const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ email, isAdmin = false, role = 'customer' }) => {
  const hashedPassword = await bcrypt.hash('Password123', 10);
  return User.create({ name: 'Test User', email, password: hashedPassword, isAdmin, role });
};

describe('Store Settings Routes Verification', () => {
  let adminAgent, userAgent, adminUser, regularUser;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), StoreSettings.deleteMany({})]);

    adminAgent = request.agent(app);
    userAgent = request.agent(app);

    const ts = Date.now();
    adminUser = await createTestUser({ email: `adm_${ts}@test.com`, isAdmin: true, role: 'admin' });
    regularUser = await createTestUser({ email: `usr_${ts}@test.com`, isAdmin: false, role: 'customer' });

    await adminAgent.post('/api/auth/login').send({ email: adminUser.email, password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: regularUser.email, password: 'Password123' });
  });

  describe('1. Public Settings Endpoint (GET /api/v1/settings)', () => {
    it('returns public settings without requiring authentication', async () => {
      const res = await request(app).get('/api/v1/settings').expect(200);

      expect(res.body).toHaveProperty('storeName');
      expect(res.body).toHaveProperty('supportEmail');
      expect(res.body).toHaveProperty('supportPhone');
      expect(res.body).toHaveProperty('currency');
      expect(res.body).toHaveProperty('shippingFee');
      // Must not expose internal admin thresholds or settings
      expect(res.body.orderAutoCancelMinutes).toBeUndefined();
    });

    it('works across both /api/v1/settings and /api/settings alias', async () => {
      const res = await request(app).get('/api/settings').expect(200);
      expect(res.body.storeName).toBe('Cartify');
    });
  });

  describe('2. Admin Settings Endpoint (GET /api/v1/admin/settings)', () => {
    it('rejects unauthenticated caller with 401', async () => {
      await request(app).get('/api/v1/admin/settings').expect(401);
    });

    it('rejects non-admin customer with 403', async () => {
      await userAgent.get('/api/v1/admin/settings').expect(403);
    });

    it('allows verified admin to fetch full store settings', async () => {
      const res = await adminAgent.get('/api/v1/admin/settings').expect(200);

      expect(res.body).toHaveProperty('settings');
      expect(res.body.settings.storeName).toBe('Cartify');
      expect(res.body.settings.shippingFee).toBe(40);
      expect(res.body.settings.defaultLowStockThreshold).toBe(5);
    });
  });

  describe('3. Admin Settings Update (PUT /api/v1/admin/settings)', () => {
    it('rejects unauthenticated caller with 401', async () => {
      await request(app).put('/api/v1/admin/settings').send({ storeName: 'New Store' }).expect(401);
    });

    it('rejects non-admin caller with 403', async () => {
      await userAgent.put('/api/v1/admin/settings').send({ storeName: 'New Store' }).expect(403);
    });

    it('rejects negative numbers for shipping fee', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings')
        .send({ shippingFee: -50 })
        .expect(400);

      expect(res.body.message).toMatch(/must be a non-negative number/i);
    });

    it('successfully updates store settings and persists', async () => {
      const updates = {
        storeName: 'Cartify Superstore',
        supportEmail: 'care@cartify.com',
        supportPhone: '1800-419-4242',
        shippingFee: 60,
        freeShippingThreshold: 999,
        defaultLowStockThreshold: 10,
      };

      const res = await adminAgent
        .put('/api/v1/admin/settings')
        .send(updates)
        .expect(200);

      expect(res.body.message).toBe('Store settings updated successfully');
      expect(res.body.settings.storeName).toBe('Cartify Superstore');
      expect(res.body.settings.shippingFee).toBe(60);
      expect(res.body.settings.freeShippingThreshold).toBe(999);

      // Verify the public endpoint reflects the update
      const pubRes = await request(app).get('/api/v1/settings').expect(200);
      expect(pubRes.body.storeName).toBe('Cartify Superstore');
      expect(pubRes.body.shippingFee).toBe(60);
    });
  });

  describe('4. Backward Compatibility Paths (/settings/admin)', () => {
    it('allows admin fetch via /api/v1/settings/admin', async () => {
      const res = await adminAgent.get('/api/v1/settings/admin').expect(200);
      expect(res.body).toHaveProperty('settings');
    });

    it('allows admin update via /api/v1/settings/admin', async () => {
      const res = await adminAgent
        .put('/api/v1/settings/admin')
        .send({ storeName: 'Cartify Legacy Update' })
        .expect(200);

      expect(res.body.settings.storeName).toBe('Cartify Legacy Update');
    });
  });
});

