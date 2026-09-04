// Product categories — single source of truth used across the app

export const PRODUCT_CATEGORIES = [
  'electronics',
  'clothing',
  'footwear',
  'accessories',
  'furniture',
  'beauty',
];

export const ORDER_STATUSES = [
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Refunded'];

export const SHIPPING_CONFIG = {
  // Free shipping threshold in INR
  FREE_SHIPPING_THRESHOLD: 999,
  // Standard shipping cost in INR (when not free)
  STANDARD_SHIPPING_COST: 79,
  // Estimated delivery in business days
  ESTIMATED_DELIVERY_DAYS: '3-5',
};

/**
 * Get product count for a given category
 */
export const getCategoryCount = (products, category) => {
  if (!category) return products.length;
  return products.filter((p) => p.category === category).length;
};

/**
 * Get the shipping cost for a given order total
 */
export const getShippingCost = (total) => {
  if (total >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_CONFIG.STANDARD_SHIPPING_COST;
};

/**
 * Get a human-readable shipping message
 */
export const getShippingMessage = (total) => {
  if (total >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD) {
    return { text: 'Free', className: 'text-green-600 font-medium' };
  }
  const remaining = SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD - total;
  return {
    text: `Add ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(remaining)} for free shipping`,
    className: 'text-gray-500',
  };
};