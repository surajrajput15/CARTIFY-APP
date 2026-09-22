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

module.exports = { protect, admin, delivery, roleAccess };
