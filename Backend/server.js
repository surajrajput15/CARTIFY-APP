const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Startup Diagnostics
console.log("🔍 MONGO_URI set hai?", process.env.MONGO_URI ? "✅ Haan" : "❌ Nahi - Render Dashboard mein DAALO!");
console.log("🔍 JWT_SECRET set hai?", process.env.JWT_SECRET ? "✅ Haan" : "❌ Nahi");

// Import Routes
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Rate Limiting - Auth endpoints (5 requests per minute)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { message: "Too many requests. Please try again after a minute." }
});

// Rate Limiting - General API (100 requests per minute)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests. Please try again later." }
});

app.use(generalLimiter);

// 🔍 DIAGNOSTIC LOGGING - har request Render Logs mein dikhega
app.use((req, res, next) => {
  console.log(`📥 Incoming: ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://cartify-hub.vercel.app'],
  credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(helmet());

// MongoDB Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Database Connected Successfully! 🗄️🎉");
  })
  .catch((error) => {
    console.log("MongoDB Connection Error: ", error.message);
    console.log("❌ Server band ho raha hai - MONGO_URI check karo Render Dashboard mein!");
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
app.use('/api/payment', paymentRoutes); // 👈 Connected Payment API
app.use('/api/upload', uploadRoutes); // 👈 Image Upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 👈 Serve images

// Test Route
app.get('/', (req, res) => {
    res.send("Backend & Database are running perfectly! 🚀");
});

// Favicon route — browser har jagah favicon maangta hai, 404 na aaye isliye
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 🔍 DIAGNOSTIC 404 HANDLER - agar koi route match nahi hua to ye chalega
app.use((req, res) => {
  console.log(`❌ No route matched for: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
