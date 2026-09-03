const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const Product = require('../models/Product');
const productRoutes = require('../routes/productRoutes');
const { protect, admin } = require('../middleware/auth');
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

app.use('/api/products', productRoutes);

// Test protected route
app.get('/api/test/admin', protect, admin, (req, res) => {
  res.json({ success: true });
});

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

describe('Product Routes', () => {
  let adminAgent, userAgent, adminUser, regularUser;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    userAgent = request.agent(app);

    // Create admin user
    adminUser = new User({ name: 'Admin', email: 'admin@test.com', password: 'Password123', isAdmin: true });
    await adminUser.save();

    // Create regular user
    regularUser = new User({ name: 'User', email: 'user@test.com', password: 'Password123', isAdmin: false });
    await regularUser.save();

    // Login both users
    await adminAgent.post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123' });
    await userAgent.post('/api/auth/login').send({ email: 'user@test.com', password: 'Password123' });
  });

  describe('GET /api/products', () => {
    it('should return empty array initially', async () => {
      const res = await request(app).get('/api/products').expect(200);
      expect(res.body.products).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return paginated products', async () => {
      const products = Array.from({ length: 15 }, (_, i) => ({
        title: `Product ${i}`,
        price: 100 + i,
        description: `Description ${i}`,
        category: 'electronics',
        image: 'https://example.com/image.jpg'
      }));
      await Product.insertMany(products);

      const res = await request(app).get('/api/products?page=1&limit=10').expect(200);
      expect(res.body.products).toHaveLength(10);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(1);
      expect(res.body.pages).toBe(2);
    });

    it('should filter by category', async () => {
      await Product.insertMany([
        { title: 'Phone', price: 500, description: 'Phone', category: 'electronics', image: 'img.jpg' },
        { title: 'Shirt', price: 50, description: 'Shirt', category: 'clothing', image: 'img.jpg' }
      ]);

      const res = await request(app).get('/api/products?category=electronics').expect(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].category).toBe('electronics');
    });

    it('should search by title (case-insensitive)', async () => {
      await Product.insertMany([
        { title: 'MacBook Pro', price: 1000, description: 'Laptop', category: 'electronics', image: 'img.jpg' },
        { title: 'Windows Laptop', price: 800, description: 'Laptop', category: 'electronics', image: 'img.jpg' }
      ]);

      const res = await request(app).get('/api/products?search=macbook').expect(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].title).toBe('MacBook Pro');
    });

    it('should sanitize regex input (ReDoS protection)', async () => {
      await Product.create({
        title: 'Normal Product',
        price: 100,
        description: 'Normal',
        category: 'electronics',
        image: 'img.jpg'
      });

      const res = await request(app).get('/api/products?search=(a+)+').expect(200);
      expect(res.body.products).toHaveLength(0);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return product by ID', async () => {
      const product = await Product.create({
        title: 'Test Product',
        price: 200,
        description: 'Test Description',
        category: 'electronics',
        image: 'https://example.com/image.jpg'
      });

      const res = await request(app).get(`/api/products/${product._id}`).expect(200);
      expect(res.body.title).toBe('Test Product');
      expect(res.body.price).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app).get(`/api/products/${fakeId}`).expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app).get('/api/products/invalid-id').expect(400);
    });
  });

  describe('POST /api/products/add (Admin)', () => {
    it('should create product with valid data (admin)', async () => {
      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .post('/api/products/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'New Product',
          price: 299,
          description: 'New product description',
          category: 'electronics',
          image: 'https://example.com/new.jpg'
        })
        .expect(201);

      expect(res.body.message).toBe('Product added successfully');
      expect(res.body.product.title).toBe('New Product');
    });

    it('should reject non-admin user', async () => {
      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .post('/api/products/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'New Product',
          price: 299,
          description: 'New product description',
          category: 'electronics',
          image: 'https://example.com/new.jpg'
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .post('/api/products/add')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Incomplete' })
        .expect(400);

      expect(res.body.message).toContain('Missing required fields');
    });

    it('should validate price is positive number', async () => {
      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .post('/api/products/add')
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Test',
          price: -10,
          description: 'Test',
          category: 'electronics',
          image: 'img.jpg'
        })
        .expect(400);

      expect(res.body.message).toContain('Price must be a positive number');
    });
  });

  describe('PATCH /api/products/:id (Admin)', () => {
    it('should update product (admin)', async () => {
      const product = await Product.create({
        title: 'Original',
        price: 100,
        description: 'Original desc',
        category: 'electronics',
        image: 'img.jpg'
      });

      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .patch(`/api/products/${product._id}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ price: 150, title: 'Updated' })
        .expect(200);

      expect(res.body.product.price).toBe(150);
      expect(res.body.product.title).toBe('Updated');
    });

    it('should reject non-admin user', async () => {
      const product = await Product.create({
        title: 'Test',
        price: 100,
        description: 'Test',
        category: 'electronics',
        image: 'img.jpg'
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .patch(`/api/products/${product._id}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ price: 150 })
        .expect(403);
    });
  });

  describe('DELETE /api/products/:id (Admin)', () => {
    it('should delete product (admin)', async () => {
      const product = await Product.create({
        title: 'To Delete',
        price: 100,
        description: 'Test',
        category: 'electronics',
        image: 'img.jpg'
      });

      const csrfToken = await getCsrfToken(adminAgent);

      await adminAgent
        .delete(`/api/products/${product._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      const deleted = await Product.findById(product._id);
      expect(deleted).toBeNull();
    });

    it('should reject non-admin user', async () => {
      const product = await Product.create({
        title: 'Test',
        price: 100,
        description: 'Test',
        category: 'electronics',
        image: 'img.jpg'
      });

      const csrfToken = await getCsrfToken(userAgent);

      await userAgent
        .delete(`/api/products/${product._id}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(403);
    });
  });

  describe('POST /api/products/seed (Admin)', () => {
    it('should bulk insert products', async () => {
      const csrfToken = await getCsrfToken(adminAgent);

      const products = Array.from({ length: 5 }, (_, i) => ({
        title: `Seed Product ${i}`,
        price: 100 + i,
        description: `Seed ${i}`,
        category: 'electronics',
        image: 'https://example.com/seed.jpg'
      }));

      const res = await adminAgent
        .post('/api/products/seed')
        .set('X-CSRF-Token', csrfToken)
        .send(products)
        .expect(201);

      expect(res.body.count).toBe(5);
    });
  });

  describe('DELETE /api/products/clear (Admin)', () => {
    it('should clear all products', async () => {
      await Product.insertMany([
        { title: 'P1', price: 100, description: 'D', category: 'electronics', image: 'img.jpg' },
        { title: 'P2', price: 200, description: 'D', category: 'electronics', image: 'img.jpg' }
      ]);

      const csrfToken = await getCsrfToken(adminAgent);

      const res = await adminAgent
        .delete('/api/products/clear')
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      expect(res.body.message).toContain('Database cleared');
      const count = await Product.countDocuments();
      expect(count).toBe(0);
    });
  });
});