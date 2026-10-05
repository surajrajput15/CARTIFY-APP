// Granular Role-Based Access Control (RBAC) System for Cartify

const PERMISSIONS = {
  // Products
  PRODUCTS_READ: 'products.read',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  
  // Orders
  ORDERS_READ: 'orders.read',
  ORDERS_VIEW: 'orders.view',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_REFUND: 'orders.refund',
  
  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_ADJUST: 'inventory.adjust',
  
  // Warehouses
  WAREHOUSES_READ: 'warehouses.read',
  WAREHOUSES_VIEW: 'warehouses.view',
  WAREHOUSES_UPDATE: 'warehouses.update',
  WAREHOUSES_MANAGE: 'warehouse.manage',
  
  // Delivery
  DELIVERY_READ: 'delivery.read',
  DELIVERY_VIEW: 'delivery.view',
  DELIVERY_ASSIGN: 'delivery.assign',
  DELIVERY_UPDATE: 'delivery.update',
  DELIVERY_MANAGE: 'delivery.manage',
  
  // Customers / Users
  USERS_READ: 'users.read',
  CUSTOMERS_VIEW: 'customers.view',
  USERS_UPDATE: 'users.update',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_SUSPEND: 'customers.suspend',
  
  // Marketing & Coupons
  COUPONS_VIEW: 'coupons.view',
  COUPONS_CREATE: 'coupons.create',
  COUPONS_UPDATE: 'coupons.update',
  COUPONS_DELETE: 'coupons.delete',
  COUPONS_MANAGE: 'coupons.manage',
  CAMPAIGNS_MANAGE: 'campaigns.manage',
  
  // Reviews
  REVIEWS_READ: 'reviews.read',
  REVIEWS_VIEW: 'reviews.view',
  REVIEWS_MODERATE: 'reviews.moderate',
  
  // Analytics & Logs
  ANALYTICS_READ: 'analytics.read',
  ANALYTICS_VIEW: 'analytics.view',
  AUDIT_LOGS_READ: 'audit_logs.read',
  AUDIT_LOGS_VIEW: 'audit_logs.view',
  
  // Settings & Staff
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',
};

// Canonical permissions alias map so both .view/.read and .adjust/.update work
const PERMISSION_ALIASES = {
  'products.view': 'products.read',
  'orders.view': 'orders.read',
  'inventory.view': 'inventory.read',
  'inventory.adjust': 'inventory.update',
  'warehouses.view': 'warehouses.read',
  'warehouse.view': 'warehouses.read',
  'warehouse.manage': 'warehouses.update',
  'delivery.view': 'delivery.read',
  'delivery.update': 'delivery.assign',
  'customers.view': 'users.read',
  'customers.update': 'users.update',
  'customers.suspend': 'users.update',
  'coupons.view': 'coupons.manage',
  'coupons.create': 'coupons.manage',
  'coupons.update': 'coupons.manage',
  'coupons.delete': 'coupons.manage',
  'reviews.view': 'reviews.read',
  'analytics.view': 'analytics.read',
  'audit_logs.view': 'audit_logs.read',
  'staff.view': 'staff.manage',
  'settings.view': 'settings.manage',
};

// All available operational roles
const ROLES = [
  'customer',
  'super_admin',
  'admin',
  'staff',
  'inventory_manager',
  'order_manager',
  'delivery_manager',
  'customer_support',
  'analyst',
  'delivery',
  'warehouse'
];

// Mapping roles to their allowed permissions
const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  staff: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.USERS_READ,
  ],
  inventory_manager: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.WAREHOUSES_READ,
    PERMISSIONS.WAREHOUSES_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
  ],
  order_manager: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.ORDERS_REFUND,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DELIVERY_ASSIGN,
    PERMISSIONS.ANALYTICS_READ,
  ],
  delivery_manager: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DELIVERY_ASSIGN,
    PERMISSIONS.DELIVERY_MANAGE,
  ],
  customer_support: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
  ],
  analyst: [
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.USERS_READ,
  ],
  delivery: [
    PERMISSIONS.DELIVERY_READ,
  ],
  warehouse: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.WAREHOUSES_READ,
  ],
  customer: []
};

/**
 * Check if a role or user has a specific permission
 */
const hasPermission = (user, permission) => {
  if (!user) return false;
  // Super admin, admin, or legacy isAdmin flag has all permissions
  if (user.isAdmin || user.role === 'super_admin' || user.role === 'admin') {
    return true;
  }
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  if (permissions.includes(permission)) return true;
  
  // Check alias
  const canonical = PERMISSION_ALIASES[permission];
  if (canonical && permissions.includes(canonical)) return true;

  // Reverse check if canonical was passed
  for (const [alias, target] of Object.entries(PERMISSION_ALIASES)) {
    if (target === permission && permissions.includes(alias)) return true;
  }

  return false;
};

module.exports = {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  PERMISSION_ALIASES,
  hasPermission
};
