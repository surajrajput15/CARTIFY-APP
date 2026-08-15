const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

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

// Razorpay webhook: signature is computed over the RAW request body, so it must be
// parsed BEFORE the global express.json() middleware (which would otherwise consume
// the stream and replace req.body with a parsed object). The actual handler lives in
// paymentRoutes.js (/api/payment/webhook).
app.post('/api/payment/webhook', express.raw({ type: 'application/json', limit: '50kb' }));

app.use(express.json({ limit: "10kb" }));
app.use(helmet());

// MongoDB Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Database Connected Successfully! 🗄️🎉");
  })
  .catch((error) => {
    console.log("MongoDB Connection Error: ", error.message);
    console.log("❌ Server failed to start - check MONGO_URI in the Render Dashboard!");
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => {
  console.log("⚠️ MongoDB disconnected!");
});

// Setup API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes); // 👈 Connected Address API
app.use('/api/cart', cartRoutes); // 👈 Connected Cart API (server-side sync)
app.use('/api/payment', paymentRoutes); // 👈 Connected Payment API
app.use('/api/upload', uploadRoutes.router); // 👈 Image Upload

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

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown — drain in-flight requests, then close MongoDB, so Render's
// restarts don't leave the process hanging or drop active connections mid-request.
const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        mongoose.connection.close(false).then(() => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
    // Force-exit if connections refuse to drain (prevents an indefinite hang).
    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
