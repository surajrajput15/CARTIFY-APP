const http = require('http');
const { initSocket, closeSocket } = require('../socket/socketServer');
const { isOriginAllowed } = require('../utils/corsConfig');

describe('Socket.IO Security & Cross-Origin Handshake Verification', () => {
  let server;
  let io;

  beforeAll((done) => {
    server = http.createServer();
    io = initSocket(server);
    server.listen(0, done);
  });

  afterAll((done) => {
    closeSocket();
    server.close(done);
  });

  describe('1. Engine.IO CORS Headers Policy', () => {
    it('sets Access-Control-Allow-Origin for official production origin', (done) => {
      const headers = {};
      const req = { headers: { origin: 'https://cartify-hub.vercel.app' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://cartify-hub.vercel.app');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      done();
    });

    it('sets Access-Control-Allow-Origin for official Cartify preview deployments', (done) => {
      const headers = {};
      const req = { headers: { origin: 'https://cartify-hub-git-feat.vercel.app' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://cartify-hub-git-feat.vercel.app');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      done();
    });

    it('sets Access-Control-Allow-Origin for allowed localhost dev origins', (done) => {
      const headers = {};
      const req = { headers: { origin: 'http://localhost:5173' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      done();
    });

    it('denies CORS headers to arbitrary attacker Vercel origins', (done) => {
      const headers = {};
      const req = { headers: { origin: 'https://attacker-app.vercel.app' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
      done();
    });

    it('denies CORS headers to lookalike domains', (done) => {
      const headers = {};
      const req = { headers: { origin: 'https://evil-cartify.vercel.app' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      done();
    });

    it('denies CORS headers to domain affix attacks', (done) => {
      const headers = {};
      const req = { headers: { origin: 'https://cartify-hub.vercel.app.attacker.com' } };
      io.engine.emit('headers', headers, req);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      done();
    });
  });

  describe('2. Handshake Middleware Origin Guard', () => {
    it('rejects connection handshake from untrusted origins with an error', () => {
      const fakeSocket = {
        handshake: {
          headers: {
            origin: 'https://malicious-app.vercel.app',
          },
        },
      };

      let errorReceived = null;
      const middlewareList = io.of('/')._fns || [];
      for (const fn of middlewareList) {
        fn(fakeSocket, (err) => {
          if (err) errorReceived = err;
        });
        if (errorReceived) break;
      }

      expect(errorReceived).toBeInstanceOf(Error);
      expect(errorReceived.message).toMatch(/Origin not allowed by CORS/i);
    });

    it('allows handshake to proceed to auth validation when origin is trusted', () => {
      const fakeSocket = {
        handshake: {
          headers: {
            origin: 'https://cartify-hub.vercel.app',
          },
          auth: {},
        },
      };

      let errorReceived = null;
      let firstMiddlewarePassed = false;

      const middlewareList = io.of('/')._fns || [];
      const originMiddleware = middlewareList[0];
      originMiddleware(fakeSocket, (err) => {
        if (!err) firstMiddlewarePassed = true;
        else errorReceived = err;
      });

      expect(firstMiddlewarePassed).toBe(true);
      expect(errorReceived).toBeNull();
    });
  });
});
