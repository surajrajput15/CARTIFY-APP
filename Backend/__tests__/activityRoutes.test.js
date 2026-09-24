const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserActivity = require('../models/UserActivity');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ email, isAdmin = false, role = 'customer' }) => {
  const hashedPassword = await bcrypt.hash('Password123', 10);
  return User.create({ name: 'T', email, password: hashedPassword, isAdmin, role });
};

// Scope polling + assertions to the test user: the suite runs test files in
// parallel against one shared MongoDB, so GLOBAL activity counts are racy.
const waitForActivity = async (userId, expected, timeoutMs = 5000) => {
  const start = Date.now();
  for (;;) {
    const n = await UserActivity.countDocuments({ userId });
    if (n >= expected) return n;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${expected} activity rows for user (have ${n})`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('Admin User Activity', () => {
  let adminAgent, userAgent, admin;

  beforeEach(async () => {
    await Promise.all([UserActivity.deleteMany({}), User.deleteMany({})]);

    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    admin = await createTestUser({ email: `act${Date.now()}a@t.com`, isAdmin: true, role: 'admin' });
    const user = await createTestUser({ email: `act${Date.now()}u@t.com` });

    await adminAgent.post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    // Auth logins produce AUTH_LOGIN noise — clear it so behaviour tests start clean.
    await UserActivity.deleteMany({});
  });

  it('rejects non-admins', async () => {
    const res = await userAgent.get('/api/admin/user-activity');
    expect(res.status).toBe(403);
  });

  it('records activity and filters by event/user', async () => {
    await adminAgent.put('/api/cart').send({ items: [] });
    await waitForActivity(admin._id, 1);

    const all = await adminAgent.get(`/api/admin/user-activity?user=${admin._id}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(1);
    expect(all.body.events[0].event).toBe('CART_SYNC');

    const byEvent = await adminAgent.get(`/api/admin/user-activity?user=${admin._id}&event=CART_SYNC`);
    expect(byEvent.body.total).toBe(1);

    const byMiss = await adminAgent.get(`/api/admin/user-activity?user=${admin._id}&event=NOPE`);
    expect(byMiss.body.total).toBe(0);

    const byEmail = await adminAgent.get(`/api/admin/user-activity?user=${admin.email.split('@')[0]}`);
    expect(byEmail.body.total).toBe(1);
  });

  it('paginates and filters by date range', async () => {
    await adminAgent.put('/api/cart').send({ items: [] });
    await waitForActivity(admin._id, 1);

    const p1 = await adminAgent.get(`/api/admin/user-activity?user=${admin._id}&limit=1&page=1`);
    expect(p1.body.total).toBe(1);
    expect(p1.body.pages).toBe(1);
    expect(p1.body.events).toHaveLength(1);

    const future = await adminAgent.get(`/api/admin/user-activity?user=${admin._id}&from=${new Date(Date.now() + 60000).toISOString()}`);
    expect(future.body.total).toBe(0);

    const badDate = await adminAgent.get('/api/admin/user-activity?from=not-a-date');
    expect(badDate.status).toBe(400);
  });

  it('exposes distinct event meta', async () => {
    const empty = await adminAgent.get('/api/admin/user-activity/meta');
    expect(empty.status).toBe(200);

    await adminAgent.put('/api/cart').send({ items: [] });
    await waitForActivity(admin._id, 1);

    const meta = await adminAgent.get('/api/admin/user-activity/meta');
    expect(meta.body.events).toContain('CART_SYNC');
  });
});
