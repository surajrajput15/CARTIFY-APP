const request = require('supertest');
const bcrypt = require('bcryptjs');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { buildTestApp, getCsrfToken } = require('./testApp');

const app = buildTestApp();

// Helper: create a user with properly hashed password
const createTestUser = async ({ name, email, password, isAdmin = false }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({ name, email, password: hashedPassword, isAdmin });
};

describe('Cart Routes', () => {
  let userAgent, user;

  beforeEach(async () => {
    userAgent = request.agent(app);

    user = await createTestUser({ name: 'Test User', email: 'cart@test.com', password: 'Password123' });
    const loginRes = await userAgent.post('/api/auth/login').send({ email: 'cart@test.com', password: 'Password123' });
    if (loginRes.status !== 200) throw new Error(`Login failed: ${loginRes.status}`);
  });

  describe('GET /api/cart', () => {
    it('should return empty cart for new user', async () => {
      const res = await userAgent.get('/api/cart').expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('should return hydrated cart items', async () => {
      const product = await Product.create({
        title: 'Test Product', price: 100, description: 'Test',
        category: 'electronics', image: 'img.jpg', countInStock: 10,
      });

      await Cart.create({
        userId: user._id,
        items: [{ productId: product._id, quantity: 2 }],
      });

      const res = await userAgent.get('/api/cart').expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Test Product');
      expect(res.body.items[0].price).toBe(100);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it('should filter out deleted products', async () => {
      const product = await Product.create({
        title: 'Test Product', price: 100, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });

      await Cart.create({
        userId: user._id,
        items: [{ productId: product._id, quantity: 1 }],
      });

      await Product.findByIdAndDelete(product._id);

      const res = await userAgent.get('/api/cart').expect(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('POST /api/cart/merge', () => {
    it('should merge local cart into server cart', async () => {
      const product = await Product.create({
        title: 'Merge Product', price: 50, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });

      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/cart/merge')
        .set('X-CSRF-Token', csrfToken)
        .send({ items: [{ productId: product._id.toString(), quantity: 3 }] })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(3);
    });

    it('should sum quantities for existing items', async () => {
      const product = await Product.create({
        title: 'Existing Product', price: 75, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });

      await Cart.create({
        userId: user._id,
        items: [{ productId: product._id, quantity: 2 }],
      });

      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/cart/merge')
        .set('X-CSRF-Token', csrfToken)
        .send({ items: [{ productId: product._id.toString(), quantity: 3 }] })
        .expect(200);

      expect(res.body.items[0].quantity).toBe(5);
    });

    it('should reject invalid product IDs', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .post('/api/cart/merge')
        .set('X-CSRF-Token', csrfToken)
        .send({ items: [{ productId: fakeId, quantity: 1 }] })
        .expect(200);

      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('PUT /api/cart', () => {
    it('should replace entire server cart', async () => {
      const product1 = await Product.create({
        title: 'Product 1', price: 100, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });
      const product2 = await Product.create({
        title: 'Product 2', price: 200, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });

      await Cart.create({
        userId: user._id,
        items: [{ productId: product1._id, quantity: 1 }],
      });

      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .put('/api/cart')
        .set('X-CSRF-Token', csrfToken)
        .send({ items: [{ productId: product2._id.toString(), quantity: 5 }] })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Product 2');
      expect(res.body.items[0].quantity).toBe(5);
    });
  });

  describe('DELETE /api/cart', () => {
    it('should clear cart', async () => {
      const product = await Product.create({
        title: 'To Clear', price: 100, description: 'Test',
        category: 'electronics', image: 'img.jpg',
      });

      await Cart.create({
        userId: user._id,
        items: [{ productId: product._id, quantity: 1 }],
      });

      const csrfToken = await getCsrfToken(userAgent);

      const res = await userAgent
        .delete('/api/cart')
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      expect(res.body.message).toBe('Cart cleared');

      const cart = await Cart.findOne({ userId: user._id });
      expect(cart).toBeNull();
    });
  });

  describe('Auth protection', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app).get('/api/cart').expect(401);
      await request(app).post('/api/cart/merge').send({}).expect(401);
      await request(app).put('/api/cart').send({}).expect(401);
      await request(app).delete('/api/cart').expect(401);
    });
  });
});