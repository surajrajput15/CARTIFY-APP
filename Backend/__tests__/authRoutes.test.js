const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');
const { protect } = require('../middleware/auth');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'lax', secure: false } });
app.use((req, res, next) => {
  const excludedPaths = ['/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/google', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me'];
  if (excludedPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  csrfProtection(req, res, next);
});

app.use('/api/auth', authRoutes);

// Protected test route
app.get('/api/test/protected', protect, (req, res) => {
  res.json({ user: req.user });
});

// Helper to get CSRF token from cookie
const getCsrfToken = async (agent) => {
  const res = await agent.get('/api/auth/csrf-token');
  // CSRF token is in cookie
  const cookies = res.headers['set-cookie'];
  if (cookies) {
    const csrfCookie = cookies.find(c => c.startsWith('csrfToken='));
    if (csrfCookie) {
      return csrfCookie.split(';')[0].split('=')[1];
    }
  }
  return null;
};

describe('Auth Routes', () => {
  let agent;

  beforeEach(() => {
    agent = request.agent(app);
  });

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP to new email', async () => {
      const res = await agent
        .post('/api/auth/send-otp')
        .send({ email: 'test@example.com' })
        .expect(200);
      
      expect(res.body.message).toContain('OTP sent successfully');
    });

    it('should reject invalid email', async () => {
      const res = await agent
        .post('/api/auth/send-otp')
        .send({ email: 'invalid-email' })
        .expect(400);
      
      expect(res.body.message).toBeDefined();
    });

    it('should enforce cooldown on repeated requests', async () => {
      await agent.post('/api/auth/send-otp').send({ email: 'cooldown@test.com' }).expect(200);
      const res = await agent.post('/api/auth/send-otp').send({ email: 'cooldown@test.com' }).expect(429);
      
      expect(res.body.message).toContain('Please wait');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should reject invalid OTP', async () => {
      await agent.post('/api/auth/send-otp').send({ email: 'verify@test.com' });
      const res = await agent
        .post('/api/auth/verify-otp')
        .send({ email: 'verify@test.com', otp: '123456' })
        .expect(400);
      
      expect(res.body.message).toContain('Invalid or Expired');
    });

    it('should lock after max attempts', async () => {
      await agent.post('/api/auth/send-otp').send({ email: 'lock@test.com' });
      
      for (let i = 0; i < 5; i++) {
        await agent.post('/api/auth/verify-otp').send({ email: 'lock@test.com', otp: '000000' });
      }
      
      const res = await agent
        .post('/api/auth/verify-otp')
        .send({ email: 'lock@test.com', otp: '000000' })
        .expect(429);
      
      expect(res.body.message).toContain('Too many incorrect attempts');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({ 
          name: 'Test User', 
          email: 'register@test.com', 
          password: 'Password123' 
        })
        .expect(201);
      
      expect(res.body.message).toBe('Account created successfully!');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('register@test.com');
    });

    it('should reject weak password', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({ 
          name: 'Test', 
          email: 'weak@test.com', 
          password: 'weak' 
        })
        .expect(400);
      
      expect(res.body.message).toContain('at least 8 characters');
    });

    it('should reject duplicate email', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Test', 
        email: 'duplicate@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .post('/api/auth/register')
        .send({ 
          name: 'Test', 
          email: 'duplicate@test.com', 
          password: 'Password123' 
        })
        .expect(400);
      
      expect(res.body.message).toContain('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Test', 
        email: 'login@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Password123' })
        .expect(200);
      
      expect(res.body.message).toBe('Login successful!');
      expect(res.body.user).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Test', 
        email: 'wrongpass@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'wrongpass@test.com', password: 'WrongPass123' })
        .expect(400);
      
      expect(res.body.message).toBe('Invalid credentials.');
    });

    it('should reject non-existent user', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'Password123' })
        .expect(400);
      
      expect(res.body.message).toContain('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Test', 
        email: 'refresh@test.com', 
        password: 'Password123' 
      });
      
      await agent.post('/api/auth/login').send({ 
        email: 'refresh@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .post('/api/auth/refresh')
        .expect(200);
      
      expect(res.body.message).toBe('Token refreshed');
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .expect(401);
      
      expect(res.body.message).toContain('No refresh token provided');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Test', 
        email: 'logout@test.com', 
        password: 'Password123' 
      });
      
      await agent.post('/api/auth/login').send({ 
        email: 'logout@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .post('/api/auth/logout')
        .expect(200);
      
      expect(res.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      await agent.post('/api/auth/register').send({ 
        name: 'Me User', 
        email: 'me@test.com', 
        password: 'Password123' 
      });
      
      await agent.post('/api/auth/login').send({ 
        email: 'me@test.com', 
        password: 'Password123' 
      });
      
      const res = await agent
        .get('/api/auth/me')
        .expect(200);
      
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('me@test.com');
      expect(res.body.user.name).toBe('Me User');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);
      
      expect(res.body.message).toContain('Not authorized');
    });
  });

  describe('CSRF protection', () => {
    it('should provide CSRF token', async () => {
      const res = await agent
        .get('/api/auth/csrf-token')
        .expect(200);
      
      expect(res.body.csrfToken).toBeDefined();
    });
  });
});