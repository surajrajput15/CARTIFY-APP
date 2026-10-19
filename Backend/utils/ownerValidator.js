// Owner-only admin allowlist (Phase D3).
// The project has exactly ONE admin owner. That owner's email is declared in
// .env as ADMIN_EMAILS. Only that address may ever hold the admin role — every
// other email is permanently a customer. This module centralises three rules:
//
//   1. isOwnerEmail(email)   — is this address allowlisted?
//   2. applyOwnerRole(user)  — sync a user's admin flags to the allowlist
//                              (auto-promote the owner, auto-strip everyone
//                              else from admin). Call it in every auth flow
//                              (google / register / login) right before token
//                              issuance.
//   3. ownerOnly()           — Express middleware: reject non-owner admins from
//                              owner-only endpoints.
//
// Security posture: even if a stale admin flag exists in the DB (set by a
// script, a manual edit, or a bad import), the moment that user logs in they
// are stripped back to customer — the allowlist self-heals on every
// authentication. Only the owner is ever re-promoted.
//
// TEST MODE: mirrors the project's rateLimitUnlessTest convention — the
// allowlist enforcement is a NO-OP so test suites can build admin accounts via
// DB flags directly (their own system). Production stays strict.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const getAdminEmails = () => {
  const raw = String(process.env.ADMIN_EMAILS || '');
  const emails = raw
    .split(',')
    .map(normalizeEmail)
    .filter((email) => EMAIL_REGEX.test(email));

  // In non-production (e.g. test or local dev without ADMIN_EMAILS configured),
  // provide a safe test fixture so automated suites and local dev work seamlessly.
  // In production (NODE_ENV === 'production'), NEVER inject any hardcoded fallback.
  if (process.env.NODE_ENV !== 'production' && emails.length === 0) {
    emails.push('admin@cartify.com');
  }

  return emails;
};

const isOwnerEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_REGEX.test(normalized)) return false;
  return getAdminEmails().includes(normalized);
};

/**
 * Validates the ADMIN_EMAILS configuration for production readiness.
 * Returns { valid: true, count, emails } or { valid: false, error }.
 */
const validateAdminEmailsConfig = () => {
  const raw = String(process.env.ADMIN_EMAILS || '').trim();
  if (!raw) {
    return {
      valid: false,
      error: 'ADMIN_EMAILS is required in production but was missing or empty.',
    };
  }

  const rawEntries = raw.split(',').map((e) => e.trim()).filter(Boolean);
  if (rawEntries.length === 0) {
    return {
      valid: false,
      error: 'ADMIN_EMAILS contains no email entries.',
    };
  }

  const invalidEntries = rawEntries.filter((email) => !EMAIL_REGEX.test(email.toLowerCase()));
  if (invalidEntries.length > 0) {
    return {
      valid: false,
      error: `ADMIN_EMAILS contains ${invalidEntries.length} invalid email address(es).`,
    };
  }

  const normalizedEmails = rawEntries.map(normalizeEmail);
  return {
    valid: true,
    count: normalizedEmails.length,
    emails: normalizedEmails,
  };
};

const OWNER_ROLE = 'admin';

// Sync admin flags to the allowlist and persist. No token is ever built on a
// stale identity. In test env this is a deliberate no-op (project convention).
async function applyOwnerRole(user) {
  if (!user || !user.email) return user;
  if (process.env.NODE_ENV === 'test') {
    return user;
  }

  const owner = isOwnerEmail(user.email);

  if (owner) {
    if (!user.isAdmin) user.isAdmin = true;
    if (user.role !== OWNER_ROLE && user.role !== 'super_admin') user.role = OWNER_ROLE;
  } else {
    if (user.isAdmin) user.isAdmin = false;
    if (user.role === OWNER_ROLE || user.role === 'super_admin') user.role = 'customer';
  }

  await user.save();
  return user;
}

// Express middleware: only the allowlisted owner may pass owner-only endpoints.
const ownerOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized' });
  if (req.user.isAdmin && isOwnerEmail(req.user.email)) {
    return next();
  }
  return res.status(403).json({ message: 'Owner-only. This account is not the owner.' });
};

module.exports = {
  isOwnerEmail,
  applyOwnerRole,
  ownerOnly,
  getAdminEmails,
  validateAdminEmailsConfig,
  normalizeEmail,
};
