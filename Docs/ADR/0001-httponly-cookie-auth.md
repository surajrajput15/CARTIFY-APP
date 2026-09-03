# ADR 0001: HttpOnly Cookie Authentication

## Status
Accepted

## Date
2026-01-15

## Context
The original authentication implementation stored JWT tokens in `localStorage` on the frontend. This approach has significant security vulnerabilities:
- **XSS attacks**: Any successful XSS attack can exfiltrate tokens from localStorage
- **Token theft**: Tokens are accessible to any JavaScript running on the page
- **No CSRF protection**: While JWTs themselves aren't sent automatically, the lack of proper cookie attributes means stolen tokens are valid until expiry

The 7-day token expiry also meant that compromised tokens had a long window of validity.

## Decision
Migrate from localStorage-based JWT to HttpOnly cookie-based authentication with:

1. **Two-token strategy**:
   - Access token: 15-minute expiry, HttpOnly + SameSite=Lax
   - Refresh token: 7-day expiry, HttpOnly + SameSite=Lax, rotated on each use

2. **Refresh token rotation**: Each use of a refresh token issues a new one and invalidates the old. If a rotated token is reused, the entire session is invalidated (reuse detection).

3. **CSRF protection**: csurf middleware with double-submit cookie pattern for state-changing operations.

4. **Server-authoritative user data**: `/me` endpoint returns the current user; the frontend only stores non-sensitive display data in localStorage.

## Consequences

### Positive
- Tokens are not accessible to JavaScript (XSS-resistant)
- Short access token expiry limits damage from token leakage
- Refresh token rotation limits the window for token theft
- CSRF protection prevents cross-site request forgery
- Automatic refresh on 401 responses provides seamless UX

### Negative
- Requires CSRF handling on the frontend
- Slightly more complex auth flow
- Requires cookie-aware fetch configuration (`withCredentials: true`)
- Initial migration requires coordination between frontend and backend

### Mitigations
- CSRF token is read from non-HttpOnly cookie and sent in `X-CSRF-Token` header
- Axios interceptor handles token refresh automatically
- Backward-compatible with existing tests and code

## Alternatives Considered

1. **Keep localStorage + shorter expiry (1 hour)**: Doesn't address XSS vulnerability
2. **Session-based auth with server-side sessions**: Requires sticky sessions or shared session store; not ideal for serverless deployments
3. **OAuth2 with external provider**: Overkill for this use case; we already have Google OAuth as an option

## References
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP Cookie Security](https://owasp.org/www-community/HttpOnly)
- [Auth0 Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)