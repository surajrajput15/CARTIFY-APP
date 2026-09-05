# Local Setup Guide — Cartify

## Prerequisites

- **Node.js 18+** and **npm**
- **MongoDB Atlas** account (free tier works) or local MongoDB
- **Razorpay** test mode account
- **Google OAuth** credentials (optional, for Google login)
- **Gmail** with App Password (or Brevo API key) for OTP emails

## Quick Start (2 terminals)

### Terminal 1 — Backend
```bash
cd C:\Users\Suraj Kumar\Desktop\CARTIFY-APP\Backend
npm install      # First time only
npm start
```

**Wait for:**
```
Environment variables validated successfully
Server is running on port 5000
{"msg":"MongoDB Database Connected Successfully with connection pooling"}
```

### Terminal 2 — Frontend
```bash
cd C:\Users\Suraj Kumar\Desktop\CARTIFY-APP\Frontend
npm install      # First time only
npm run dev
```

**Wait for:**
```
VITE v8.1.0  ready in Xms

➜  Local:   http://localhost:5173/   (or 5174, 5175)
```

## Open Browser
Go to `http://localhost:XXXX/` (check terminal for actual port)

## Test Full Flow

1. **Register**: Click "Sign In" → "Create account" → Enter email, name, password (min 8 chars, 1 upper, 1 lower, 1 digit)
2. **Login**: Use email + password (or OTP via Gmail)
3. **Browse**: Click categories, search products
4. **Add to Cart**: Click cart icon on any product
5. **Checkout**: Go to cart → "Proceed to Checkout" → Select address
6. **Pay**: Click "Pay" → Razorpay opens
7. **Test Card**: `4111 1111 1111 1111`, any future expiry, any CVV
8. **Order Success**: Order is created, stock decremented
9. **Profile**: View orders, addresses, settings
10. **Logout**: Click logout in profile

## Seed Products (Optional)

```bash
cd Backend
node seedProducts.js
```

Adds 20 sample products to the database.

## Make User Admin

```bash
cd Backend
node scripts/makeAdmin.js your@email.com
```

## Verify CSRF Token (after page load)

1. Open DevTools → Application → Cookies
2. Should see `csrfToken` cookie with `HttpOnly: false`

## Troubleshooting

### Backend won't start
- **Port 5000 in use**: `npx kill-port 5000` or change `PORT` in `Backend/.env`
- **MONGO_URI not set**: Check `Backend/.env` has valid Atlas URI
- **Atlas paused**: Login to Atlas dashboard → Resume cluster

### Frontend won't connect
- **Wrong API URL**: Check `VITE_API_URL` in `Frontend/.env`
- **Port mismatch**: Vite auto-picks port, check terminal output
- **CORS error**: Backend allows `localhost:5173-5175`

### 403 Forbidden on cart/payment
- **Restart backend** after editing `Backend/server.js` CSRF config
- Check `axios.js` has `fetchCsrfToken` and `main.jsx` calls it
- See `.opencode/skills/csrx/SKILL.md` for full debugging

### Razorpay not opening
- **Keys mismatch**: `VITE_RAZORPAY_KEY` must equal `RAZORPAY_KEY_ID`
- **Not test mode**: Both keys must start with `rzp_test_`
- **Browser console**: Check for `lumberjack.razorpay.com` errors (analytics, not critical)

### Email not sending
- **Gmail App Password**: Generate at https://myaccount.google.com/apppasswords
- **Brevo API**: Check `BREVO_API_KEY` is valid
- **Test OTP login**: After registering, click "Login with OTP"

## Run Tests

```bash
# Backend tests (61 tests)
cd Backend
npm test

# Frontend tests (26 tests)
cd Frontend
npm test

# Build for production
cd Frontend
npm run build
```

## Environment Variables Reference

### Backend/.env
```env
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/cartify
JWT_SECRET=<32+ char random hex>
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_app_password
BREVO_API_KEY=your_brevo_key
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### Frontend/.env
```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY=rzp_test_xxxxxxxx
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

## Common Commands

| Task | Command |
|------|---------|
| Start backend | `cd Backend && npm start` |
| Start frontend | `cd Frontend && npm run dev` |
| Run all tests | `cd Backend && npm test && cd ../Frontend && npm test` |
| Build frontend | `cd Frontend && npm run build` |
| Seed products | `cd Backend && node seedProducts.js` |
| Make admin | `cd Backend && node scripts/makeAdmin.js email@example.com` |
| Kill port 5000 | `npx kill-port 5000` |

## Project Structure

```
CARTIFY-APP/
├── Backend/         # Node.js + Express API (port 5000)
├── Frontend/        # React + Vite SPA (port 5173+)
├── Docs/             # Engineering documentation
├── .opencode/        # Agent context, skills, MCPs
├── start-dev.sh      # Convenience script (may not work on Windows)
└── README.md
```

## Next Steps

1. Read `.opencode/AGENTS.md` for full project context
2. Read `.opencode/WORKFLOW.md` for dev workflow
3. Read `.opencode/skills/csrx/SKILL.md` if you get 403 errors
4. Read `.opencode/skills/payment/SKILL.md` if Razorpay doesn't work
