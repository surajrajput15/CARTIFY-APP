# AGENTS.md — Cartify Project Context

## What is Cartify?
A full-stack e-commerce platform (MERN stack) with:
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 + React Router 7
- **Backend**: Node.js 18 + Express 4 + Mongoose 9 + MongoDB Atlas
- **Auth**: HttpOnly cookies (access 15m + refresh 7d) + JWT + CSRF protection
- **Payment**: Razorpay (test mode) with server-authoritative verification
- **Email**: Gmail SMTP fallback / Brevo HTTP API
- **Image**: Cloudinary
- **Deployment**: Vercel (frontend) + Render (backend)

## Critical Workflow Knowledge

### 1. CSRF Flow (recently fixed)
- Backend sets a CSRF cookie at `/api/auth/csrf-token` (this endpoint is excluded from CSRF)
- Frontend reads cookie and sends it as `X-CSRF-Token` header on POST/PUT/DELETE
- Cookie must have `httpOnly: false` so JS can read it
- `axios.js` has a 403 retry: if request fails with 403, it re-fetches the token and retries once
- `main.jsx` calls `fetchCsrfToken()` on app startup

### 2. Razorpay Localhost
- Must use Razorpay **test mode** keys (rzp_test_*)
- Backend has `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`
- For Razorpay to work, the frontend key (`VITE_RAZORPAY_KEY`) must match the backend's test key
- Razorpay needs HTTP (not HTTPS) for localhost — works fine
- If Razorpay fails to open, check browser console for `lumberjack.razorpay.com/v2/logz` errors (these are analytics, not critical)

### 3. MongoDB Atlas
- Connection string in `Backend/.env` as `MONGO_URI`
- Free tier clusters **PAUSE after inactivity** — if `querySrv EREFUSED` error, resume from Atlas dashboard
- Local dev: Atlas works fine, just needs internet

### 4. Environment Variables
- `Backend/.env` — MONGO_URI, JWT_SECRET, RAZORPAY keys, GOOGLE_CLIENT_ID, EMAIL, CLOUDINARY
- `Frontend/.env` — VITE_API_URL (http://localhost:5000), VITE_RAZORPAY_KEY, VITE_GOOGLE_CLIENT_ID

## Local Dev Start Sequence
```bash
# Terminal 1 — Backend
cd Backend
npm start
# Wait for: "Server is running on port 5000"

# Terminal 2 — Frontend
cd Frontend
npm run dev
# Wait for: "Local: http://localhost:5173/" (or 5174/5175 if 5173 in use)
# Open browser to that URL
```

## Common Gotchas
- **CSRF 403 on logout/cart/payment**: Restart backend after editing `server.js` CSRF config
- **Razorpay not opening**: Check `VITE_RAZPORAY_KEY` matches `RAZORPAY_KEY_ID` in test mode
- **Atlas DNS error**: Resume cluster from Atlas dashboard (free tier pauses)
- **Port 5000 in use**: Kill old node process or change `PORT` in `.env`
- **Module not found errors after pulling new code**: `npm install` in both `Backend/` and `Frontend/`

## Project Structure
```
CARTIFY-APP/
├── Backend/          # Node.js + Express API
│   ├── server.js     # Entry point with all middleware
│   ├── routes/       # 7 route files (auth, cart, products, etc.)
│   ├── models/       # Mongoose schemas (User, Product, Cart, Order, Address)
│   ├── middleware/   # protect (JWT) + admin (role check)
│   ├── utils/        # logger, redisCache, swagger, etc.
│   └── __tests__/    # 61 backend tests
├── Frontend/         # React + Vite SPA
│   ├── src/
│   │   ├── api/axios.js    # CSRF + 401 refresh + state-transition logging
│   │   ├── context/        # AuthProvider, CartProvider, BackendStatusProvider
│   │   ├── pages/          # 8 page components
│   │   ├── components/     # 15+ shared components
│   │   └── main.jsx        # Calls fetchCsrfToken() on startup
│   └── playwright.config.ts
├── Docs/              # Engineering documentation
└── .opencode/         # Agent skills + MCPs + context (this directory)
```

## When Working on This Project
1. **Always read the backend log first** — it tells you exactly what's failing
2. **Check if backend was restarted after code changes** — most CSRF issues are stale code
3. **Verify env vars match** between backend `.env` and frontend `.env` for shared keys (Razorpay, Google)
4. **Test with browser DevTools open** — Network tab shows exact 403/401 responses

## Common Tasks & Their Commands

| Task | Command |
|------|---------|
| Start backend | `cd Backend && npm start` |
| Start frontend | `cd Frontend && npm run dev` |
| Run backend tests | `cd Backend && npm test` |
| Run frontend tests | `cd Frontend && npm test` |
| Build frontend | `cd Frontend && npx vite build` |
| Seed products | `cd Backend && node seedProducts.js` |
| Make user admin | `cd Backend && node scripts/makeAdmin.js email@example.com` |

## Recent Major Changes
- **CSRF fix** (server.js): Added `/api/auth/csrf-token`, `/api/auth/refresh`, `/api/auth/logout` to excluded paths
- **axios.js**: Added `fetchCsrfToken()` helper and 403 retry interceptor
- **main.jsx**: Calls `fetchCsrfToken()` on app startup

## File Structure Notes
- `Backend/server.js` — Single entry, all middleware in order
- `Backend/routes/` — 7 route files
- `Frontend/src/api/axios.js` — Centralized HTTP client with all interceptors
- `Frontend/src/main.jsx` — App entry point
- `.opencode/` — Agent context (this file) + skills + MCPs
