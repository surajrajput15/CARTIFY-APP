const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const Address = require('../models/Address');
const addressRoutes = require('../routes/addressRoutes');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'lax', secure: false } });
app.use((req, res, next) => {
  const excludedPaths = ['/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/google', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me', '/api/auth/csrf-token'];
  if (excludedPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  csrfProtection(req, res, next);
});

app.use('/api/addresses', addressRoutes);

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

describe('Address Routes', () => {
  let userAgent, user;

  beforeEach(async () => {
    userAgent = request.agent(app);

    user = new User({ name: 'Test User', email: 'address@test.com', password: 'Password123' });
    await user.save();
    await userAgent.post('/api/auth/login').send({ email: 'address@test.com', password: 'Password123' });
  });

  describe('POST /api/addresses/add', () => {
    it('should create address with valid data', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/addresses/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          fullName: 'Test User',
          phone: '9876543210',
          street: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          pinCode: '123456'
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
          fullName: 'Test',
          phone: '12345',
          street: '123 St',
          city: 'City',
          state: 'State',
          pinCode: '123456'
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
          fullName: 'Test',
          phone: '9876543210',
          street: '123 St',
          city: 'City',
          state: 'State',
          pinCode: '12345'
        })
        .expect(400);

      expect(res.body.message).toContain('6 digits');
    });
  });

  describe('GET /api/addresses/:userId', () => {
    it('should return user addresses', async () => {
      await Address.create({
        userId: user._id,
        fullName: 'Test User',
        phone: '9876543210',
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        pinCode: '123456'
      });

      const res = await userAgent
        .get(`/api/addresses/${user._id}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].fullName).toBe('Test User');
    });

    it('should reject accessing another user\'s addresses', async () => {
      const otherUser = new User({ name: 'Other', email: 'other@test.com', password: 'Password123' });
      await otherUser.save();

      await userAgent
        .get(`/api/addresses/${otherUser._id}`)
        .expect(403);
    });

    it('should return empty array for user with no addresses', async () => {
      const res = await userAgent
        .get(`/api/addresses/${user._id}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /api/addresses/:id', () => {
    it('should delete own address', async () => {
      const address = await Address.create({
        userId: user._id,
        fullName: 'Test User',
        phone: '9876543210',
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        pinCode: '123456'
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
        fullName: 'Other User',
        phone: '9876543210',
        street: '123 St',
        city: 'City',
        state: 'State',
        pinCode: '123456'
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