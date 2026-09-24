const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { buildTestApp } = require('./testApp');

const app = buildTestApp();

const createTestUser = async ({ email, isAdmin = false, role = 'customer' }) => {
  const hashedPassword = await bcrypt.hash('Password123', 10);
  return User.create({ name: 'T', email, password: hashedPassword, isAdmin, role });
};

// Audit writes happen on response 'finish' (fire-and-forget), so poll.
const waitForAuditCount = async (expected, timeoutMs = 5000) => {
  const start = Date.now();
  for (;;) {
    const n = await AuditLog.countDocuments({});
    if (n >= expected) return n;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${expected} audit rows (have ${n})`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('Admin Audit Logs', () => {
  let adminAgent, userAgent, admin;

  beforeEach(async () => {
    await Promise.all([AuditLog.deleteMany({}), User.deleteMany({})]);

    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    admin = await createTestUser({ email: `aud${Date.now()}a@t.com`, isAdmin: true, role: 'admin' });
    const user = await createTestUser({ email: `aud${Date.now()}u@t.com` });

    await adminAgent.post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: user.email, password: 'Password123' });
  });

  it('rejects non-admins', async () => {
    const res = await userAgent.get('/api/admin/audit-logs');
    expect(res.status).toBe(403);
  });

  it('records audited actions and filters by action/resource/user/success', async () => {
    const ok = await adminAgent.post('/api/warehouses').send({ name: 'Audit Hub', code: 'AUD', city: 'C', state: 'S' });
    expect(ok.status).toBe(201);

    const bad = await adminAgent.post('/api/warehouses').send({ name: 'Nope' });
    expect(bad.status).toBe(400);

    await waitForAuditCount(2);

    const all = await adminAgent.get('/api/admin/audit-logs');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(all.body.pages).toBe(1);

    const byAction = await adminAgent.get('/api/admin/audit-logs?action=CREATE_WAREHOUSE');
    expect(byAction.body.total).toBe(2);

    const byResource = await adminAgent.get('/api/admin/audit-logs?resource=Warehouse');
    expect(byResource.body.total).toBe(2);

    const byUser = await adminAgent.get(`/api/admin/audit-logs?user=${admin.email.split('@')[0]}`);
    expect(byUser.body.total).toBe(2);

    const byUserId = await adminAgent.get(`/api/admin/audit-logs?user=${admin._id}`);
    expect(byUserId.body.total).toBe(2);

    const failed = await adminAgent.get('/api/admin/audit-logs?success=false');
    expect(failed.body.total).toBe(1);
    expect(failed.body.logs[0].success).toBe(false);

    const succeeded = await adminAgent.get('/api/admin/audit-logs?success=true');
    expect(succeeded.body.total).toBe(1);

    const none = await adminAgent.get('/api/admin/audit-logs?action=NOPE_NOTHING');
    expect(none.body.total).toBe(0);
    expect(none.body.logs).toHaveLength(0);
  });

  it('paginates and filters by date range', async () => {
    for (let i = 0; i < 3; i += 1) {
      const r = await adminAgent.post('/api/warehouses').send({ name: `Hub ${i}`, code: `P${i}`, city: 'C', state: 'S' });
      expect(r.status).toBe(201);
    }
    await waitForAuditCount(3);

    const p1 = await adminAgent.get('/api/admin/audit-logs?limit=2&page=1');
    expect(p1.body.total).toBe(3);
    expect(p1.body.pages).toBe(2);
    expect(p1.body.logs).toHaveLength(2);

    const p2 = await adminAgent.get('/api/admin/audit-logs?limit=2&page=2');
    expect(p2.body.logs).toHaveLength(1);

    const future = await adminAgent.get(`/api/admin/audit-logs?from=${new Date(Date.now() + 60000).toISOString()}`);
    expect(future.body.total).toBe(0);

    const past = await adminAgent.get(`/api/admin/audit-logs?to=${new Date(Date.now() + 60000).toISOString()}`);
    expect(past.body.total).toBe(3);

    const badDate = await adminAgent.get('/api/admin/audit-logs?from=not-a-date');
    expect(badDate.status).toBe(400);
  });

  it('exposes distinct filter metadata', async () => {
    const empty = await adminAgent.get('/api/admin/audit-logs/meta');
    expect(empty.status).toBe(200);
    expect(empty.body.actions).toEqual([]);

    const created = await adminAgent.post('/api/warehouses').send({ name: 'Meta Hub', code: 'MET', city: 'C', state: 'S' });
    expect(created.status).toBe(201);
    await waitForAuditCount(1);

    const meta = await adminAgent.get('/api/admin/audit-logs/meta');
    expect(meta.body.actions).toContain('CREATE_WAREHOUSE');
    expect(meta.body.resources).toContain('Warehouse');
    expect(meta.body.roles).toContain('admin');
  });
});
