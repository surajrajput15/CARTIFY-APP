// Friendly-format normalizers for Indian phone numbers and PIN codes.
// Users type "+91 98765 43210", "098765-43210", "110 001" etc. — these accept
// such inputs and return canonical digits, or null when nothing valid remains.

const normalizeIndianPhone = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let digits = String(value).replace(/[^\d]/g, '');
  // Strip country code (+91 arrives here as leading 91) or trunk 0.
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

const normalizePinCode = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/[^\d]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
};

module.exports = { normalizeIndianPhone, normalizePinCode };
