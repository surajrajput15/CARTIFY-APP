const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { notifyMonitoring } = require('../services/telegram/monitoringService');

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
    req.user = await User.findById(decoded.id).select('-password -otp -otpExpire -refreshToken -refreshTokenExpire -previousRefreshToken -previousRefreshTokenExpire');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (req.user.status === 'blocked') {
      return res.status(403).json({
        message: req.user.blockReason ? `Your account has been suspended: ${req.user.blockReason}` : 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_BLOCKED'
      });
    }
    if (req.user.status === 'deactivated') {
      return res.status(403).json({
        message: 'Your account is deactivated. Please contact support to reactivate.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const { hasPermission } = require('../utils/permissions');

const OPERATIONAL_ROLES = [
  'super_admin',
  'admin',
  'staff',
  'inventory_manager',
  'order_manager',
  'delivery_manager',
  'customer_support',
  'analyst',
  'warehouse'
];

const admin = (req, res, next) => {
  if (req.user && (req.user.isAdmin || OPERATIONAL_ROLES.includes(req.user.role))) {
    next();
  } else {
    notifyMonitoring('SECURITY_UNAUTHORIZED_ADMIN', {
      email: req.user?.email || 'Anonymous',
      ip: req.ip,
      path: req.originalUrl,
    }, { req });
    return res.status(403).json({ message: 'Not authorized as admin' });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (hasPermission(req.user, permission)) {
      next();
    } else {
      notifyMonitoring('SECURITY_UNAUTHORIZED_ADMIN', {
        email: req.user.email,
        ip: req.ip,
        path: req.originalUrl,
        requiredPermission: permission,
      }, { req });
      return res.status(403).json({
        message: `Forbidden: requires '${permission}' permission`,
        code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS'
      });
    }
  };
};

// Delivery partner middleware — checks role === 'delivery'.
// Admins pass too (full-control portal access); per-order/per-list scoping
// for admin mode is enforced inside the route handlers, not here.
const delivery = (req, res, next) => {
  if (req.user && (req.user.role === 'delivery' || req.user.isAdmin)) {
    next();
  } else {
    return res.status(403).json({ message: 'Not authorized as delivery partner' });
  }
};

// Warehouse staff middleware — checks role === 'warehouse'.
// Admins pass too (full-control portal access); warehouse scoping for admin
// mode is enforced inside myWarehouse (explicit ?warehouseId=), not here.
const warehouse = (req, res, next) => {
  if (req.user && (req.user.role === 'warehouse' || req.user.isAdmin)) {
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

module.exports = { protect, admin, delivery, warehouse, roleAccess, softProtect, requirePermission };
