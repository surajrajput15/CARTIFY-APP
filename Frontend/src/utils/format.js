// Formatting utilities for consistent display across the app

/**
 * Format a number as Indian Rupee currency.
 * @param {number|string} price - The price value
 * @param {object} options - Formatting options
 * @returns {string} Formatted price string with ₹ symbol
 */
export const formatPrice = (price, options = {}) => {
  const { showDecimals = true, locale = 'en-IN' } = options;
  const num = Number(price);
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num);
};

/**
 * Format a number with thousand separators.
 * @param {number|string} value - The number value
 * @returns {string} Formatted number string
 */
export const formatNumber = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
};

/**
 * Format a date string as a readable date.
 * @param {string|Date} date - The date value
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
};

/**
 * Format a date string with time.
 * @param {string|Date} date - The date value
 * @returns {string} Formatted date+time string
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Safely extract the first name from a full name string.
 * @param {string} fullName - The full name
 * @returns {string} First name or fallback
 */
export const getFirstName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'there';
  return fullName.trim().split(/\s+/)[0] || 'there';
};

/**
 * Safely get the first character of a name (uppercased) for avatar display.
 * @param {string} fullName - The full name
 * @returns {string} First character uppercase, or '?' as fallback
 */
export const getInitial = (fullName) => {
  const firstName = getFirstName(fullName);
  return firstName.charAt(0).toUpperCase() || '?';
};

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export const truncate = (str, maxLength = 50) => {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
};

/**
 * Calculate discount percentage between two prices.
 * @param {number} originalPrice - Original price
 * @param {number} discountedPrice - Discounted price
 * @returns {number} Discount percentage (rounded down)
 */
export const calculateDiscount = (originalPrice, discountedPrice) => {
  const orig = Number(originalPrice);
  const disc = Number(discountedPrice);
  if (isNaN(orig) || isNaN(disc) || orig <= 0 || disc >= orig) return 0;
  return Math.floor(((orig - disc) / orig) * 100);
};