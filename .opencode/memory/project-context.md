# Project Context Memo — Cartify

## What This Project Is
Full-stack e-commerce platform (MERN stack) — Mongoose + Express + React + Node.js.

## Tech Stack
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 + React Router 7 + Axios
- **Backend**: Node.js 18 + Express 4 + Mongoose 9 + JWT + Razorpay
- **Database**: MongoDB Atlas (free tier — pauses after inactivity)
- **Payment**: Razorpay (test mode)
- **Email**: Gmail SMTP fallback / Brevo HTTP API
- **Image**: Cloudinary
- **Auth**: HttpOnly cookies (access 15m + refresh 7d) + CSRF protection
- **Deployment**: Vercel (frontend) + Render (backend)

## Recent Critical Changes

### CSRF Fix (most recent)
- **Backend/server.js**: Added `/api/auth/csrf-token`, `/api/auth/refresh`, `/api/auth/logout` to `excludedPaths` in CSRF middleware
- **Cookie config**: `httpOnly: false` so frontend JS can read the CSRF token
- **Frontend/src/api/axios.js**: Added `fetchCsrfToken()` helper and 403 retry interceptor
- **Frontend/src/main.jsx**: Calls `fetchCsrfToken()` on app startup to ensure cookie is set

## File Structure
```
CARTIFY-APP/
├── Backend/          # Node.js + Express API
│   ├── server.js     # Entry point with middleware
│   ├── routes/       # 7 route files
│   ├── models/       # Mongoose schemas
│   └── utils/        # logger, redisCache, swagger, etc.
├── Frontend/         # React + Vite SPA
│   ├── src/
│   │   ├── api/axios.js    # Centralized HTTP client
│   │   ├── context/        # AuthProvider, CartProvider
│   │   ├── pages/          # 8 page components
│   │   └── components/     # Shared components
│   └── main.jsx            # App entry
├── Docs/              # Engineering docs
├── .opencode/         # Agent context (this directory)
│   ├── AGENTS.md
│   ├── TOOLS.md
│   ├── WORKFLOW.md
│   ├── skills/
│   ├── mcp/
│   └── memory/
└── README.md
```

## Local Dev Start Sequence
```bash
# Terminal 1
cd Backend && npm start
# Wait for: "Server is running on port 5000"

# Terminal 2
cd Frontend && npm run dev
# Wait for: "Local: http://localhost:XXXX/"
# Open browser to that URL
```

## Common Gotchas
- **CSRF 403**: Restart backend after editing `Backend/server.js` CSRF config
- **Razorpay 403**: Check `VITE_RAZORPAY_KEY` matches `RAZORPAY_KEY_ID` (test mode)
- **Atlas DNS error**: Resume cluster from Atlas dashboard (free tier pauses)
- **Port in use**: `npx kill-port 5000` or change `PORT` in `Backend/.env`
- **Module not found**: `npm install` in both `Backend/` and `Frontend/`

## Environment Variables
### Backend (.env)
- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — 32+ char random hex
- `RAZORPAY_KEY_ID` — Test mode `rzp_test_*`
- `RAZORPAY_KEY_SECRET` — Razorpay test secret
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `EMAIL_USER` / `EMAIL_PASS` — Gmail SMTP (or `BREVO_API_KEY`)
- `CLOUDINARY_*` — Image upload

### Frontend (.env)
- `VITE_API_URL=http://localhost:5000`
- `VITE_RAZORPAY_KEY` — Must match backend `RAZORPAY_KEY_ID`
- `VITE_GOOGLE_CLIENT_ID` — Must match backend `GOOGLE_CLIENT_ID`

## Testing
- Backend: `cd Backend && npm test` — 61 tests
- Frontend: `cd Frontend && npm test` — 26 tests
- Build: `cd Frontend && npx vite build`

## Current Open Issues (if any)
- Atlas free tier cluster pauses after inactivity (manual resume from dashboard)
- Razorpay localhost works but `lumberjack.razorpay.com` analytics may be blocked by adblockers
- CSRF flow requires restart after `Backend/server.js` changes

## Deployment Info
- Frontend: Vercel → `https://cartify-hub.vercel.app`
- Backend: Render → `https://cartify-api-10g3.onrender.com`
- Database: MongoDB Atlas
- Payment: Razorpay (live keys in production)
