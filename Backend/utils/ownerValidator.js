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

const getAdminEmails = () =>
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => String(email).trim().toLowerCase())
    .filter(Boolean);

const isOwnerEmail = (email) => {
  if (!email) return false;
  return getAdminEmails().includes(String(email).trim().toLowerCase());
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
    if (user.role !== OWNER_ROLE) user.role = OWNER_ROLE;
  } else {
    if (user.isAdmin) user.isAdmin = false;
    if (user.role === OWNER_ROLE) user.role = 'customer';
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

module.exports = { isOwnerEmail, applyOwnerRole, ownerOnly, getAdminEmails };
