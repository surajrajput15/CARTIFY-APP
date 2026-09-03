const request = require('supertest');
const { buildTestApp, getCsrfToken } = require('./testApp');

const app = buildTestApp();

describe('Auth Routes', () => {
  let agent;

  beforeEach(() => {
    agent = request.agent(app);
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'register@test.com',
          password: 'Password123',
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
          password: 'weak',
        })
        .expect(400);

      expect(res.body.message).toContain('at least 8 characters');
    });

    it('should reject duplicate email', async () => {
      await agent.post('/api/auth/register').send({
        name: 'Test',
        email: 'duplicate@test.com',
        password: 'Password123',
      });

      const res = await agent
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'duplicate@test.com',
          password: 'Password123',
        })
        .expect(400);

      expect(res.body.message).toContain('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await agent.post('/api/auth/register').send({
        name: 'Test',
        email: 'login@test.com',
        password: 'Password123',
      });
    });

    it('should login with valid credentials', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Password123' })
        .expect(200);

      expect(res.body.message).toBe('Login successful!');
      expect(res.body.user).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'WrongPass123' })
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
});