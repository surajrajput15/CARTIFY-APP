# ADR 0004: Multi-Method Authentication

## Status
Accepted

## Date
2026-01-15

## Context
E-commerce users have diverse preferences for authentication:
- Some prefer traditional email/password
- Some prefer passwordless (OTP) for convenience
- Some prefer social login (Google) for speed

We need to support multiple methods while keeping the codebase maintainable and the user experience consistent.

## Decision
Support three authentication methods:

1. **Email + Password (bcrypt + JWT)**
   - 8+ char password with upper/lower/digit requirements
   - bcrypt with 10 salt rounds
   - Secure password reset via OTP

2. **OTP (Passwordless)**
   - 6-digit code, 10-minute expiry
   - SHA-256 hashed in database (not plaintext)
   - 5 failed attempts locks the OTP
   - 30-second cooldown between sends

3. **Google OAuth (Server-side ID token verification)**
   - Uses `google-auth-library` on backend
   - Verifies audience, issuer, email_verified
   - Auto-creates account on first login

All three methods issue the same cookie-based auth tokens (access + refresh).

## Consequences

### Positive
- Covers all user preferences
- OTP reduces friction for first-time users
- Google OAuth reduces friction for return users
- Password reset is unified
- Single auth context in frontend handles all methods

### Negative
- More code paths to maintain
- Email service is critical infrastructure
- Google OAuth requires Google Cloud Console setup

### Mitigations
- Email fallback (Brevo HTTP API, then Gmail SMTP)
- Fail-fast email configuration validation
- Unified token issuance across all methods
- Comprehensive tests for each method

## Alternatives Considered

1. **Only password**: Higher friction, more password reset requests
2. **Only OTP**: Some users prefer passwords
3. **Only social**: Excludes users without Google accounts
4. **Magic link via email**: More secure than OTP but slower UX

## References
- [Google Identity Services](https://developers.google.com/identity)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Brevo Transactional Email](https://developers.brevo.com/reference/sendtransacemail)