const request = require('supertest');
const bcrypt = require('bcryptjs');
const Address = require('../models/Address');
const User = require('../models/User');
const { buildTestApp, getCsrfToken } = require('./testApp');

const app = buildTestApp();

// Helper: create a user with properly hashed password
const createTestUser = async ({ name, email, password, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin });
};

describe('Address Routes', () => {
  let userAgent, user;

  beforeEach(async () => {
    userAgent = request.agent(app);

    user = await createTestUser({ name: 'Test User', email: 'address@test.com', password: 'Password123' });
    const loginRes = await userAgent.post('/api/auth/login').send({ email: 'address@test.com', password: 'Password123' });
    if (loginRes.status !== 200) throw new Error(`Login failed: ${loginRes.status}`);
  });

  describe('POST /api/addresses/add', () => {
    it('should create address with valid data', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/addresses/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          fullName: 'Test User', phone: '9876543210', street: '123 Test Street',
          city: 'Test City', state: 'Test State', pinCode: '123456',
        })
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.fullName).toBe('Test User');
      expect(res.body.phone).toBe('9876543210');
      expect(res.body.userId.toString()).toBe(user._id.toString());
    });

    it('should validate required fields', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/addresses/add')
        .set('X-CSRF-Token', csrfToken)
        .send({ fullName: 'Test' })
        .expect(400);

      expect(res.body.message).toContain('is required');
    });

    it('should validate phone format (10-digit Indian)', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/addresses/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          fullName: 'Test', phone: '12345', street: '123 St',
          city: 'City', state: 'State', pinCode: '123456',
        })
        .expect(400);

      expect(res.body.message).toContain('10-digit Indian number');
    });

    it('should validate PIN code format (6 digits)', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/addresses/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          fullName: 'Test', phone: '9876543210', street: '123 St',
          city: 'City', state: 'State', pinCode: '12345',
        })
        .expect(400);

      expect(res.body.message).toContain('6 digits');
    });
  });

  describe('GET /api/addresses/:userId', () => {
    it('should return user addresses', async () => {
      await Address.create({
        userId: user._id,
        fullName: 'Test User', phone: '9876543210', street: '123 Test St',
        city: 'Test City', state: 'Test State', pinCode: '123456',
      });

      const res = await userAgent.get(`/api/addresses/${user._id}`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].fullName).toBe('Test User');
    });

    it('should reject accessing another user\'s addresses', async () => {
      const otherUser = new User({ name: 'Other', email: 'other@test.com', password: 'Password123' });
      await otherUser.save();

      await userAgent.get(`/api/addresses/${otherUser._id}`).expect(403);
    });

    it('should return empty array for user with no addresses', async () => {
      const res = await userAgent.get(`/api/addresses/${user._id}`).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /api/addresses/:id', () => {
    it('should delete own address', async () => {
      const address = await Address.create({
        userId: user._id,
        fullName: 'Test User', phone: '9876543210', street: '123 Test St',
        city: 'Test City', state: 'Test State', pinCode: '123456',
      });

      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .delete(`/api/addresses/${address._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      expect(res.body.message).toBe('Address deleted successfully');

      const deleted = await Address.findById(address._id);
      expect(deleted).toBeNull();
    });

    it('should reject deleting another user\'s address', async () => {
      const otherUser = new User({ name: 'Other', email: 'other@test.com', password: 'Password123' });
      await otherUser.save();

      const address = await Address.create({
        userId: otherUser._id,
        fullName: 'Other User', phone: '9876543210', street: '123 St',
        city: 'City', state: 'State', pinCode: '123456',
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .delete(`/api/addresses/${address._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(403);
    });

    it('should return 404 for non-existent address', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .delete(`/api/addresses/${fakeId}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(404);
    });
  });
});