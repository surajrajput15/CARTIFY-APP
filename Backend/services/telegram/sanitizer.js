/**
 * Data Sanitizer for Monitoring and Telegram Notifications
 * Strips sensitive credentials, tokens, PII, and raw signatures.
 */

const SENSITIVE_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'otp',
  'token',
  'accesstoken',
  'refreshtoken',
  'credential',
  'secret',
  'authorization',
  'cookie',
  'signature',
  'razorpay_signature',
  'cvv',
  'card',
  'cardnumber',
  'apikey',
];

/**
 * Mask an email address (e.g. surajdona2005@gmail.com -> s***5@gmail.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[UNKNOWN]';
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return '[INVALID_EMAIL]';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

/**
 * Mask a phone number (e.g. +91 9876543210 -> ******3210)
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '[REDACTED]';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '[REDACTED]';
  return `******${cleaned.slice(-4)}`;
}

/**
 * Sanitize address to remove street name and phone, keeping only city & state
 */
function sanitizeAddress(address) {
  if (!address || typeof address !== 'object') return null;
  return {
    city: address.city || '[UNKNOWN]',
    state: address.state || '[UNKNOWN]',
    pinCode: address.pinCode ? `${String(address.pinCode).slice(0, 3)}***` : undefined,
  };
}

/**
 * Deep sanitize an object or primitive
 */
function sanitizePayload(data, depth = 0) {
  if (data === null || data === undefined) return data;
  if (depth > 6) return '[TRUNCATED]';

  if (typeof data === 'string') {
    // Redact JWT tokens if detected in string
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(data)) {
      return '[REDACTED_JWT]';
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.slice(0, 20).map(item => sanitizePayload(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check against sensitive keys
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (lowerKey === 'email') {
      sanitized[key] = maskEmail(value);
      continue;
    }

    if (lowerKey === 'phone' || lowerKey === 'phonenumber') {
      sanitized[key] = maskPhone(value);
      continue;
    }

    if (lowerKey === 'shippingaddress' || lowerKey === 'address') {
      sanitized[key] = sanitizeAddress(value);
      continue;
    }

    sanitized[key] = sanitizePayload(value, depth + 1);
  }

  return sanitized;
}

module.exports = {
  maskEmail,
  maskPhone,
  sanitizeAddress,
  sanitizePayload,
};
