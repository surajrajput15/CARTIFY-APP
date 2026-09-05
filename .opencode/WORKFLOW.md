# WORKFLOW.md — Local Development → Test → Commit Cycle

## Standard Workflow

### 1. Start Development Environment

```bash
# Terminal 1 — Backend
cd Backend
npm start
# Wait for: "Server is running on port 5000" and "MongoDB Database Connected Successfully"

# Terminal 2 — Frontend
cd Frontend
npm run dev
# Wait for: "Local: http://localhost:XXXX/" (5173, 5174, or 5175)
# Open browser to that URL
```

### 2. Test Full Flow

1. **Open browser** to frontend URL (e.g., `http://localhost:5174`)
2. **Open DevTools** (F12) → Console tab
3. **Test each flow**:
   - Register new user → should succeed without 403
   - Login → should work
   - Add product to cart → POST /api/cart/merge should succeed
   - View cart → GET /api/cart should return items
   - Go to checkout → select address
   - Click "Pay" → Razorpay should open
   - Logout → POST /api/auth/logout should succeed

4. **Verify in DevTools → Application → Cookies**:
   - `csrfToken` cookie should exist with `HttpOnly: false`
   - `accessToken` cookie should exist with `HttpOnly: true`
   - `refreshToken` cookie should exist with `HttpOnly: true`

### 3. Run Tests

```bash
# Backend tests
cd Backend
npm test
# Should show: 61 passed, 61 total

# Frontend tests
cd Frontend
npm test
# Should show: 26 passed, 26 total
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "fix: description of what was fixed

Detailed explanation if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

# Push to remote
git push origin main
```

## Debugging Workflow

### When CSRF 403 errors appear:

1. **Check backend log** — does it say "invalid csrf token"?
2. **Verify `Backend/server.js`** has these in `excludedPaths`:
   - `/api/auth/csrf-token`
   - `/api/auth/refresh`
   - `/api/auth/logout`
3. **Restart backend** — `cd Backend && npm start`
4. **Refresh frontend** — hard reload (Ctrl+Shift+R)
5. **Check browser console** — should see `fetchCsrfToken()` call in Network tab
6. **Verify CSRF cookie** in DevTools → Application → Cookies

### When Razorpay doesn't open:

1. **Check browser console** for `lumberjack.razorpay.com` errors (these are analytics, not critical)
2. **Verify `VITE_RAZORPAY_KEY`** in `Frontend/.env` matches `RAZORPAY_KEY_ID` in `Backend/.env`
3. **Check Razorpay dashboard** — make sure keys are in **test mode** (not live)
4. **Verify payment route** is not blocked by CSRF — `/api/payment/create-order` should be in excluded paths or have valid CSRF token

### When MongoDB connection fails:

1. **Check `Backend/.env`** — `MONGO_URI` should be set
2. **Test connection** — `cd Backend && node -e "require('mongoose').connect(process.env.MONGO_URI).then(() => console.log('OK'))"`
3. **Check Atlas dashboard** — free tier clusters pause after inactivity
4. **Resume cluster** from Atlas dashboard if paused
5. **Whitelist IP** — add `0.0.0.0/0` to Atlas Network Access for dev

### When frontend doesn't load:

1. **Check port** — Vite auto-picks next available port (5173 → 5174 → 5175)
2. **Check terminal** — see which port Vite is using
3. **Check `Frontend/.env`** — `VITE_API_URL` should be `http://localhost:5000`
4. **Clear browser cache** — Ctrl+Shift+R
5. **Check console for errors** — CORS, network, or build errors

## Git Workflow

### Branch Strategy
- `main` — Production code
- Feature branches off `main` for new work

### Commit Message Format
```
<type>: <short description>

<optional body explaining what and why>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Before Committing
- ✅ All tests pass (`npm test` in both Backend and Frontend)
- ✅ Build succeeds (`npm run build` in Frontend)
- ✅ Backend runs without errors
- ✅ Frontend loads in browser
- ✅ Core flows tested (login, cart, checkout, logout)

### After Committing
- ✅ Push to remote: `git push origin main`
- ✅ Verify GitHub Actions pass (if configured)
- ✅ Update todo list to mark items complete

## Local Development Best Practices

1. **Always run backend first** — frontend depends on backend
2. **Check both terminal outputs** — errors appear in both
3. **Use browser DevTools** — Network tab shows exact requests
4. **Test with multiple browsers** — sometimes Chrome caches differently
5. **Clear localStorage** — if auth state gets stale
6. **Restart after env changes** — `.env` is read on startup

## Deployment Workflow (Future)

When ready to deploy:
1. **Build frontend**: `cd Frontend && npm run build`
2. **Deploy backend** to Render
3. **Deploy frontend** to Vercel
4. **Update env vars** on hosting platforms
5. **Test production** at `https://cartify-hub.vercel.app`
