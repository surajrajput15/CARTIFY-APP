// Friendly-format normalizers for Indian phone numbers and PIN codes.
// Users type "+91 98765 43210", "098765-43210", "110 001" etc. — these accept
// such inputs and return canonical digits, or null when nothing valid remains.

export const normalizeIndianPhone = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let digits = String(value).replace(/[^\d]/g, '');
  // Strip leading 0091 or 91 country code
  if (digits.startsWith('0091')) {
    digits = digits.slice(4);
  } else if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // Strip leading trunk zero (e.g. 09876543210 -> 9876543210)
  if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

export const normalizePinCode = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/[^\d]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
};
