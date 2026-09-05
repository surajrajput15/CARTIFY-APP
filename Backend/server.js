const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const crypto = require('crypto');
const Sentry = require('@sentry/node');
require('dotenv').config();
const { logger, createChildLogger } = require('./utils/logger');
const { cache, getRedisClient } = require('./utils/redisCache');

// Sentry initialization
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.mongoIntegration(),
    ],
  });
}

// Request ID middleware for tracing
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Environment Validation
const requiredBackendVars = [
  { key: 'MONGO_URI', label: 'MongoDB URI' },
  { key: 'JWT_SECRET', label: 'JWT Secret' },
  { key: 'RAZORPAY_KEY_ID', label: 'Razorpay Key ID' },
  { key: 'RAZORPAY_KEY_SECRET', label: 'Razorpay Key Secret' },
  { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID' },
];

const missingBackend = requiredBackendVars.filter(v => !process.env[v.key]);
if (missingBackend.length > 0) {
  console.error(`Missing environment variables: ${missingBackend.map(v => `${v.key} (${v.label})`).join(', ')}`);
  process.exit(1);
}

// Email configuration — required for OTP login and password reset. Either the Brevo
// HTTP API key, or the Gmail SMTP fallback (EMAIL_USER + EMAIL_PASS) must be present.
// On Render the SMTP fallback cannot work (outbound SMTP is blocked), so without a
// configured email path core auth flows silently break — fail fast instead.
const hasBrevoApiKey = !!process.env.BREVO_API_KEY;
const hasSmtpFallback = !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS;

if (!hasBrevoApiKey && !hasSmtpFallback) {
  console.error(
    'Missing email configuration. Set BREVO_API_KEY, or the Gmail SMTP fallback ' +
    '(EMAIL_USER + EMAIL_PASS), otherwise OTP login and password reset will be unavailable.'
  );
  process.exit(1);
}

console.log('Environment variables validated successfully');

// Import Routes
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const cartRoutes = require('./routes/cartRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust Render's proxy so express-rate-limit correctly identifies users by IP
// Without this, rate-limit logs "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR" warnings
app.set('trust proxy', 1);

// Rate Limiting - Auth endpoints (5 requests per minute)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { message: "Too many requests. Please try again after a minute." }
});

// Rate Limiting - General API (200 requests per minute, burst of 300)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { message: "Too many requests. Please try again later." }
});

app.use(generalLimiter);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://cartify-hub.vercel.app',
    ];
    // Allow all Vercel preview deployments (*.vercel.app)
    if (!origin || allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());

// Razorpay webhook: signature is computed over the RAW request body, so it must be
// parsed BEFORE the global express.json() middleware (which would otherwise consume
// the stream and replace req.body with a parsed object). The actual handler lives in
// paymentRoutes.js (/api/payment/webhook).
app.post('/api/payment/webhook', express.raw({ type: 'application/json', limit: '50kb' }));

app.use(express.json({ limit: "10kb" }));

// CSRF Protection - exclude webhook, auth endpoints that use JWT in body, and cart read operations
const csrfProtection = csrf({ cookie: { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } });
app.use((req, res, next) => {
  const excludedPaths = [
    '/api/payment/webhook',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/google'
  ];
  // Only exclude GET /api/cart (cart reads) - mutations need CSRF
  if (req.method === 'GET' && req.path.startsWith('/api/cart')) {
    return next();
  }
  if (excludedPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  csrfProtection(req, res, next);
});

// Helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://cartify-api-10g3.onrender.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      frameSrc: ["'self'", 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Request ID middleware for tracing
app.use(requestIdMiddleware);

// Sentry request handler (must be before routes)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ status: 'not ready', reason: 'database disconnected' });
    }
    // Quick ping
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not ready', reason: error.message });
  }
});

// MongoDB Database Connection with connection pool tuning
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50, // Maximum number of connections
  minPoolSize: 10, // Minimum number of connections
  maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
  serverSelectionTimeoutMS: 5000, // How long to wait for a server
  socketTimeoutMS: 45000, // How long a send or receive on a socket can take
  family: 4, // Use IPv4
  retryWrites: true, // Retry write operations
  w: 'majority', // Write concern
})
  .then(() => {
    logger.info('MongoDB Database Connected Successfully with connection pooling');
  })
  .catch((error) => {
    logger.error({ err: error }, 'MongoDB Connection Error');
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error');
});

// Setup API Routes - Versioned
const v1Routes = require('./routes/index');
app.use('/api/v1', v1Routes);
app.use('/api', v1Routes); // Backward compatibility (defaults to v1)

// Legacy routes (kept for backward compatibility - will be deprecated)
app.use('/api/products', productRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes.router);

// Swagger API Documentation
const { setupSwagger } = require('./utils/swagger');
setupSwagger(app);

// Serve uploaded images with a strict allowlist of safe content types. Files
// are stored with a detected-format extension only, but this layer hardens
// against serving any stray/non-image payload and disables content sniffing.
const IMAGE_CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = IMAGE_CONTENT_TYPES[ext];
    if (contentType) {
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', 'inline');
    } else {
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', 'attachment');
    }
    res.set('X-Content-Type-Options', 'nosniff');
  }
})); // 👈 Serve images

// Test Route
app.get('/', (req, res) => {
    res.send("Backend & Database are running perfectly! 🚀");
});

// Favicon route — browsers request a favicon everywhere; avoid a 404 for it
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 404 handler - no route matched
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown — drain in-flight requests, then close MongoDB and Redis, so Render's
// restarts don't leave the process hanging or drop active connections mid-request.
const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down gracefully...');
    server.close(async () => {
        try {
            await Promise.all([
                mongoose.connection.close(false),
                cache.close(),
            ]);
            logger.info('All connections closed');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error }, 'Error during shutdown');
            process.exit(1);
        }
    });
    // Force-exit if connections refuse to drain (prevents an indefinite hang).
    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
