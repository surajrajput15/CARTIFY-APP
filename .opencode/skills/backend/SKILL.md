# Backend Skill

## When to use
Any task involving the Node.js/Express backend — modifying routes, middleware, models, or server config.

## Key files
- `Backend/server.js` — Entry point with all middleware
- `Backend/routes/*.js` — 7 route files
- `Backend/models/*.js` — Mongoose schemas
- `Backend/middleware/*.js` — protect (JWT) + admin (role check)
- `Backend/utils/*.js` — logger, redisCache, swagger, etc.

## How to start the backend
```bash
cd Backend
npm start          # Production mode (node server.js)
npm run dev        # Dev mode (nodemon, requires nodemon installed)
```

Backend runs on port 5000. Wait for log: `Server is running on port 5000`.

## How to run tests
```bash
cd Backend
npm test                    # All tests
npm run test:coverage       # With coverage
```

Current: 61 tests passing.

## CSRF Configuration (critical!)
In `Backend/server.js` lines 129-153, the CSRF middleware MUST have these in `excludedPaths`:
- `/api/payment/webhook` (Razorpay webhook)
- `/api/auth/send-otp`
- `/api/auth/verify-otp`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/google`
- `/api/auth/csrf-token` ← Required for frontend to get token
- `/api/auth/refresh` ← Required for token refresh
- `/api/auth/logout` ← Required for logout

CSRF cookie config: `httpOnly: false` (so frontend JS can read it).

## Common backend tasks

### Add a new route
1. Create/edit `Backend/routes/yourRoute.js`
2. Mount in `Backend/server.js`: `app.use('/api/yourroute', yourRoute);`
3. Add CSRF exclusion if it's a POST/PUT/DELETE that needs to work without CSRF
4. Test: `cd Backend && npm test`

### Add a new model
1. Create `Backend/models/YourModel.js`
2. Export the model: `module.exports = mongoose.model('YourModel', yourSchema);`
3. Use in routes: `const YourModel = require('../models/YourModel');`

### Modify CSRF exclusions
Edit `Backend/server.js` `excludedPaths` array, then restart backend.

### Debug 403 errors
1. Check backend log for "invalid csrf token"
2. Verify the endpoint is in `excludedPaths` or the frontend sends `X-CSRF-Token` header
3. Restart backend after changes

## Environment Variables
Read from `Backend/.env`:
- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — 32+ char random hex
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Test or live keys
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `EMAIL_USER` / `EMAIL_PASS` — Gmail SMTP
- `BREVO_API_KEY` — Email service
- `CLOUDINARY_*` — Image upload

## Database Connection
- MongoDB Atlas (free tier pauses after inactivity)
- Connection pool: max 50, min 10
- Local dev works fine with Atlas (just needs internet)
- If `querySrv EREFUSED` error, resume cluster from Atlas dashboard

## Health Check Endpoints
- `GET /health` — Returns 200 OK
- `GET /ready` — Checks MongoDB connection (returns 503 if disconnected)
- `GET /` — Returns "Backend & Database are running perfectly"

## Logging
Uses Pino logger. Logs are JSON-formatted in development.
Suppress noisy errors in production via `Backend/utils/logger.js`.
