# CSRF Skill

## When to use
Debugging 403 Forbidden errors on state-changing requests (POST/PUT/DELETE).

## The CSRF Flow

### 1. Token Generation (Backend)
- `Backend/routes/authRoutes.js` has `GET /csrf-token` endpoint
- Returns: `{ csrfToken: "..." }` and sets `csrfToken` cookie
- Middleware in `Backend/server.js` (csurf) generates the token

### 2. Token Reading (Frontend)
- `Frontend/src/api/axios.js` has `getCsrfToken()` helper
- Reads `document.cookie` for `csrfToken` cookie
- Adds `X-CSRF-Token` header to all POST/PUT/PATCH/DELETE requests

### 3. Token Validation (Backend)
- `Backend/server.js` csurf middleware validates the header
- If invalid, returns 403 "invalid csrf token"

## Critical Configuration

### Backend/server.js (line 130)
```javascript
const csrfProtection = csrf({
  cookie: {
    httpOnly: false,  // ← MUST be false so JS can read the cookie
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});
```

### Backend/server.js (line 131-152) — Excluded paths
These MUST be in `excludedPaths`:
```javascript
const excludedPaths = [
  '/api/payment/webhook',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/google',
  '/api/auth/csrf-token',   // ← Required for frontend to get token
  '/api/auth/refresh',      // ← Required for token refresh
  '/api/auth/logout'        // ← Required for logout
];
```

### Frontend/src/api/axios.js
```javascript
// Request interceptor — add CSRF token to state-changing requests
api.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken();
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Response interceptor — retry on 403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.config && !error.config._csrfRetried) {
      error.config._csrfRetried = true;
      try {
        await api.get('/api/auth/csrf-token');
        const freshToken = getCsrfToken();
        if (freshToken) {
          error.config.headers['X-CSRF-Token'] = freshToken;
        }
        return api(error.config);
      } catch (refreshError) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
```

### Frontend/src/main.jsx
```javascript
import { fetchCsrfToken } from './api/axios';

// Proactively fetch CSRF token on app startup
fetchCsrfToken();
```

## Debugging 403 Errors

### Step 1: Check if backend has the fix
```bash
cd Backend
grep -n "csrf-token" server.js
# Should show: '/api/auth/csrf-token'  // Allow fetching CSRF token
```

### Step 2: Check if backend was restarted
After editing `server.js`, restart:
```bash
cd Backend
npm start
```

### Step 3: Check frontend is sending the token
1. Open DevTools → Network tab
2. Make a POST request (e.g., add to cart)
3. Check Request Headers → should have `X-CSRF-Token: <value>`

### Step 4: Check cookie is set
1. DevTools → Application → Cookies
2. Should see `csrfToken` cookie with `HttpOnly: false`

### Step 5: Check browser console
Look for:
- `fetchCsrfToken` call in Network tab (should see GET /api/auth/csrf-token on app load)
- No "invalid csrf token" errors

## Common Causes of 403

| Cause | Fix |
|-------|-----|
| Cookie not set | Restart backend, refresh frontend |
| Cookie `httpOnly: true` | Change to `false` in `server.js` |
| Endpoint in CSRF exclusion incorrectly | Add/remove from `excludedPaths` |
| Frontend not sending header | Check `axios.js` request interceptor |
| Cookie domain mismatch | Ensure `sameSite: 'lax'` |
| Secure cookie on HTTP | Set `secure: false` in development |

## Test the Fix Manually

1. Start backend
2. Open browser DevTools → Network tab
3. Navigate to `http://localhost:5174`
4. Look for GET /api/auth/csrf-token request on page load
5. Check Response Headers → should have `Set-Cookie: csrfToken=...`
6. Try to add item to cart
7. Check Request Headers → should have `X-CSRF-Token: <value>`
8. If 403, the token is missing or invalid

## Quick Fix Script

If you keep getting 403 errors, run this in browser DevTools console:
```javascript
// Manually fetch CSRF token
fetch('http://localhost:5000/api/auth/csrf-token', { credentials: 'include' })
  .then(r => r.json())
  .then(d => {
    document.cookie = `csrfToken=${d.csrfToken}; path=/`;
    console.log('CSRF token set:', d.csrfToken);
  });
```

## Related Files
- `Backend/server.js` — CSRF middleware config
- `Backend/routes/authRoutes.js` — Token endpoint
- `Frontend/src/api/axios.js` — Interceptors
- `Frontend/src/main.jsx` — Startup fetch

## Common Misconceptions
- **CSRF is not optional** — Required for security, but should be transparent to user
- **CORS != CSRF** — CORS is for cross-origin, CSRF is for same-origin form submissions
- **JWT != CSRF** — JWT is for auth, CSRF is for state-changing requests
- **HttpOnly affects only JS access** — Backend still reads the cookie; only frontend JS can't

## When to Use This Skill
- 403 Forbidden errors on POST/PUT/DELETE
- "invalid csrf token" in backend log
- Cart operations failing
- Payment flow failing
- Logout failing
