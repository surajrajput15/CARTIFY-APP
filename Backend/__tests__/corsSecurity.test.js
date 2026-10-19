const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { corsOptions, isOriginAllowed } = require('../utils/corsConfig');

describe('CORS Configuration & Origin Security Verification', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors(corsOptions));
    app.get('/api/test-cors', (req, res) => {
      res.json({ message: 'cors success' });
    });
    app.post('/api/test-cors', (req, res) => {
      res.json({ message: 'post success' });
    });
  });

  describe('1. Allowed Origins (Production & Approved Local)', () => {
    it('allows exact production storefront origin https://cartify-hub.vercel.app with credentials', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://cartify-hub.vercel.app')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('https://cartify-hub.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows standard local development origin http://localhost:5173 with credentials', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows standard local development origin http://localhost:5174 with credentials', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'http://localhost:5174')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows official Cartify Vercel preview deployment (e.g. cartify-hub-git-feature.vercel.app)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://cartify-hub-git-feature.vercel.app')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('https://cartify-hub-git-feature.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('2. Untrusted Origins Rejection (No Reflection, No Credentials)', () => {
    it('rejects arbitrary attacker Vercel origins (e.g. https://attacker-domain.vercel.app)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://attacker-domain.vercel.app')
        .expect(200);

      // Must NOT reflect origin or credentials
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('rejects domain affix attacks (e.g. https://cartify-hub.vercel.app.attacker.com)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://cartify-hub.vercel.app.attacker.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('rejects lookalike domains (e.g. https://evil-cartify.vercel.app)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://evil-cartify.vercel.app')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('rejects lookalike domains (e.g. https://cartify-evil.vercel.app)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://cartify-evil.vercel.app')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('rejects generic untrusted origins (e.g. https://evil.com)', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://evil.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('rejects malformed origins (e.g. null, javascript:, http://)', async () => {
      const origins = ['null', 'javascript:alert(1)', 'https://', 'http://'];
      for (const origin of origins) {
        const res = await request(app)
          .get('/api/test-cors')
          .set('Origin', origin)
          .expect(200);

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      }
    });
  });

  describe('3. Preflight Handling (OPTIONS)', () => {
    it('handles preflight for trusted origin with expected CORS headers', async () => {
      const res = await request(app)
        .options('/api/test-cors')
        .set('Origin', 'https://cartify-hub.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, X-CSRF-Token')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe('https://cartify-hub.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('denies preflight headers for untrusted origins', async () => {
      const res = await request(app)
        .options('/api/test-cors')
        .set('Origin', 'https://attacker.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('4. Server-to-Server Requests (No Origin Header)', () => {
    it('preserves legitimate non-browser requests without Origin header', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .expect(200);

      expect(res.body.message).toBe('cors success');
      // No Origin was sent, so no Access-Control-Allow-Origin should be emitted
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('5. Unit Check on isOriginAllowed', () => {
    it('correctly classifies allowed and disallowed origins', () => {
      expect(isOriginAllowed('https://cartify-hub.vercel.app')).toBe(true);
      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:5174')).toBe(true);
      expect(isOriginAllowed('https://cartify-hub-deploy-123.vercel.app')).toBe(true);
      expect(isOriginAllowed('https://attacker.vercel.app')).toBe(false);
      expect(isOriginAllowed('https://evil-cartify.vercel.app')).toBe(false);
      expect(isOriginAllowed('https://cartify-hub.vercel.app.attacker.com')).toBe(false);
      expect(isOriginAllowed('')).toBe(true);
      expect(isOriginAllowed(undefined)).toBe(true);
    });
  });
});
