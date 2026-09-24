const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // First check for token in HttpOnly cookie
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Fallback for backward compatibility during transition
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Refresh tokens must never be usable as access tokens (7d vs 15m scope).
    if (decoded.type === 'refresh') {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    req.user = await User.findById(decoded.id).select('-password -otp -otpExpire -refreshToken -refreshTokenExpire');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({ message: 'Not authorized as admin' });
  }
};

// Delivery partner middleware — checks role === 'delivery'
const delivery = (req, res, next) => {
  if (req.user && req.user.role === 'delivery') {
    next();
  } else {
    return res.status(403).json({ message: 'Not authorized as delivery partner' });
  }
};

// Warehouse staff middleware — checks role === 'warehouse'
const warehouse = (req, res, next) => {
  if (req.user && req.user.role === 'warehouse') {
    next();
  } else {
    return res.status(403).json({ message: 'Not authorized as warehouse staff' });
  }
};

// Role-based access middleware — allows specific roles
const roleAccess = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ message: 'Not authorized for this resource' });
    }
  };
};

// Soft auth for public routes that want identity when available (e.g. product
// browse tracking): attaches req.user when a valid access token is present,
// otherwise continues anonymously. Never rejects.
const softProtect = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'refresh') return next();
    const user = await User.findById(decoded.id).select('-password -otp -otpExpire -refreshToken -refreshTokenExpire');
    if (user) req.user = user;
  } catch {
    // Invalid/expired token on a public route: stay anonymous.
  }
  next();
};

module.exports = { protect, admin, delivery, warehouse, roleAccess, softProtect };
