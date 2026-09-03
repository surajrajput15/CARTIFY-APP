# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- HttpOnly cookie-based JWT authentication with refresh token rotation
- CSRF protection with double-submit cookie pattern
- Content Security Policy (CSP) via Helmet
- Request ID middleware for distributed tracing
- Structured logging with Pino and PII redaction
- Health check endpoints (`/health`, `/ready`)
- Sentry error tracking (frontend + backend)
- Audit logging for admin actions
- MongoDB indexes for query performance
- Connection pool tuning
- Redis cache layer
- Image optimization with Cloudinary (`f_auto,q_auto` + srcset)
- Virtualization for admin product table
- API versioning (`/api/v1`)
- Zod validation schemas
- OpenAPI/Swagger documentation at `/api/docs`
- TypeScript type definitions
- Database migrations with `migrate-mongo`
- Per-endpoint rate limits
- Skeleton loaders
- Per-route error boundaries
- Vite bundle analyzer
- GitHub Actions CI/CD pipeline
- Dependabot weekly dependency PRs
- Comprehensive test suite (unit, integration, E2E)
- Deployment runbook
- Contributing guide with code review checklist
- Architecture Decision Records (ADRs)

### Changed
- Migrated from localStorage JWT to HttpOnly cookies
- Replaced manual validation with Zod schemas
- Improved accessibility (focus rings, tap targets, color contrast)
- Optimized bundle with manual chunks
- Reduced cold start time with connection pool tuning

### Security
- Eliminated XSS token theft via HttpOnly cookies
- Added CSRF protection for state-changing operations
- Implemented refresh token rotation with reuse detection
- Added Content Security Policy headers
- Removed error stack traces from client responses
- Added rate limiting per endpoint type

## [1.0.0] - 2025-12-15

### Added
- Initial release
- Multi-method authentication (password, OTP, Google OAuth)
- Product catalog with search, filter, pagination
- Shopping cart with server-side sync
- Order management with Razorpay payments
- Address book with validation
- Admin panel for product management
- User profile management
- Image upload (Cloudinary + local fallback)
- PWA support
- Responsive design (mobile, tablet, desktop)
- Basic accessibility (ARIA, skip links, semantic HTML)

### Security
- JWT authentication with bcrypt password hashing
- Helmet HTTP headers
- Rate limiting (auth: 5/min, general: 200/min)
- Input validation and sanitization
- ReDoS protection on search
- Server-authoritative payment processing
- HMAC SHA256 payment signature verification
- Stock reservation with rollback on payment failure
- TTL-based pending order cleanup

[1.0.0]: https://github.com/surajrajput999/CARTIFY-APP/releases/tag/v1.0.0