const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

// Socket.IO realtime layer (V2 live tracking).
//
// Rooms:
  //   user:{userId}      — personal customer/partner events (order updates)
  //   admin              — admin dashboard broadcasts
  //   delivery:{userId}  — delivery partner assignment pings
  //   warehouse:{userId} — warehouse staff alerts (low stock, transfers)
  //   order:{orderId}    — everyone authorized on one order (customer, assigned
  //                        partner, admins) — live courier location lives here
//
// Handshake auth reuses the SAME HttpOnly accessToken cookie as the REST API
// (or an explicit auth.token from cross-origin clients). Refresh tokens are
// rejected exactly like middleware/auth.js does.
//
// Emission helpers are exported separately (emitOrderUpdate etc.) so REST
// routes broadcast through this module; they are no-ops before initSocket().

let io = null;
let UserRef = null;
let DeliveryLocationRef = null;
let OrderRef = null;

const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];
const IS_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const loadModels = () => {
  // Lazy requires keep test environments (supertest) from opening sockets.
  if (!UserRef) UserRef = require('../models/User');
  if (!DeliveryLocationRef) DeliveryLocationRef = require('../models/DeliveryLocation');
  if (!OrderRef) OrderRef = require('../models/Order');
};

const initSocket = (httpServer) => {
  loadModels();
  const { Server } = require('socket.io');

  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://cartify-hub.vercel.app',
      ],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Allow any *.vercel.app origin (mirrors server.js REST CORS policy).
  io.engine.on('headers', (headers, req) => {
    const origin = req.headers.origin;
    if (origin && /^https:\/\/.*\.vercel\.app$/.test(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Vary'] = headers['Vary'] ? `${headers['Vary']}, Origin` : 'Origin';
    }
  });

  // ---------------------------------------------------------------------------
  // Handshake auth
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || null;
      if (!token && socket.handshake.headers?.cookie) {
        const cookiePair = socket.handshake.headers.cookie
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('accessToken='));
        if (cookiePair) token = decodeURIComponent(cookiePair.split('=')[1]);
      }
      if (!token) return next(new Error('Not authorized, no token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type === 'refresh') return next(new Error('Not authorized, token failed'));
      const user = await UserRef.findById(decoded.id).select('name email role isAdmin');
      if (!user) return next(new Error('User not found'));

      socket.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        // isAdmin flag remains the admin source of truth (same as REST admin middleware).
        role: user.isAdmin ? 'admin' : (user.role || 'customer'),
      };
      next();
    } catch (err) {
      next(new Error('Not authorized, token failed'));
    }
  });

  // ---------------------------------------------------------------------------
  io.on('connection', (socket) => {
    const u = socket.user;
    socket.join(`user:${u.id}`);
    if (u.role === 'admin') socket.join('admin');
    if (u.role === 'delivery') socket.join(`delivery:${u.id}`);
    if (u.role === 'warehouse') socket.join(`warehouse:${u.id}`);

    // Subscribe to one order's live events (authorization enforced server-side).
    socket.on('order:subscribe', async ({ orderId } = {}) => {
      try {
        const id = String(orderId || '');
        if (!IS_OBJECT_ID.test(id)) return;
        const order = await OrderRef.findById(id).select('userId deliveryPartnerId').lean();
        if (!order) return;
        const allowed =
          u.role === 'admin' ||
          (order.userId && order.userId.toString() === u.id) ||
          (order.deliveryPartnerId && order.deliveryPartnerId.toString() === u.id);
        if (!allowed) return;
        socket.join(`order:${id}`);
        // Fresh position right away so the tracking map doesn't wait a full ping.
        const loc = await DeliveryLocationRef.findOne({ orderId: order._id }).lean();
        if (loc && loc.active) {
          socket.emit('courier:location', {
            orderId: id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            updatedAt: loc.updatedAt,
          });
        }
      } catch (err) {
        logger.warn({ err: err?.message || 'order:subscribe failed' }, 'order:subscribe failed');
      }
    });

    socket.on('order:unsubscribe', ({ orderId } = {}) => {
      if (orderId) socket.leave(`order:${orderId}`);
    });

    // Delivery partner GPS ping (lower latency than REST; REST fallback exists).
    socket.on('courier:ping', async ({ orderId, latitude, longitude } = {}) => {
      try {
        if (u.role !== 'delivery') return;
        const id = String(orderId || '');
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!IS_OBJECT_ID.test(id)) return;
        if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) return;

        const order = await OrderRef.findById(id).select('deliveryPartnerId deliveryStatus').lean();
        if (!order || !order.deliveryPartnerId || order.deliveryPartnerId.toString() !== u.id) return;
        if (!ACTIVE_DELIVERY_STATUSES.includes(order.deliveryStatus)) return;

        const loc = await DeliveryLocationRef.findOneAndUpdate(
          { deliveryPartnerId: u.id },
          { $set: { orderId: order._id, latitude: lat, longitude: lng, active: true } },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        const payload = { orderId: id, latitude: lat, longitude: lng, updatedAt: loc.updatedAt };
        io.to(`order:${id}`).emit('courier:location', payload);
        io.to('admin').emit('courier:location', { ...payload, partnerId: u.id });
      } catch (err) {
        logger.warn({ err: err?.message || 'courier:ping failed' }, 'courier:ping failed');
      }
    });
  });

  return io;
};

// ---------------------------------------------------------------------------
// Broadcast helpers used by REST routes (no-ops when sockets are not running,
// e.g. in unit tests or before initSocket()).
const emitOrderUpdate = (order) => {
  if (!io || !order) return;
  const payload = {
    orderId: order._id?.toString?.() || String(order._id),
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    updatedAt: order.updatedAt || new Date().toISOString(),
  };
  io.to(`order:${payload.orderId}`).emit('order:updated', payload);
  if (order.userId) {
    const userId = order.userId._id ? order.userId._id.toString() : order.userId.toString();
    io.to(`user:${userId}`).emit('order:updated', payload);
  }
  io.to('admin').emit('order:updated', payload);
  if (order.deliveryPartnerId) {
    const partnerId = order.deliveryPartnerId._id
      ? order.deliveryPartnerId._id.toString()
      : order.deliveryPartnerId.toString();
    io.to(`delivery:${partnerId}`).emit('delivery:assignment', payload);
  }
};

const emitCourierLocation = (payload) => {
  if (!io || !payload) return;
  if (payload.orderId) io.to(`order:${payload.orderId}`).emit('courier:location', payload);
  io.to('admin').emit('courier:location', payload);
};

const getIo = () => io;

const closeSocket = () => {
  if (io) {
    io.close();
    io = null;
  }
};

module.exports = {
  initSocket,
  emitOrderUpdate,
  emitCourierLocation,
  getIo,
  closeSocket,
};