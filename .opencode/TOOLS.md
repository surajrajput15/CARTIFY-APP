# TOOLS.md — Available Skills and MCPs

## Agent Skills (`.opencode/skills/`)

### 1. `cartify-backend` (auto-loaded)
**When to use**: Any backend (Node.js/Express) task — modifying routes, middleware, models, or server config.

**Capabilities**:
- Start/stop backend: `cd Backend && npm start`
- Run tests: `cd Backend && npm test`
- Read backend env: `Backend/.env`
- Apply changes to `Backend/server.js` and route files
- Trigger backend restart after edits

### 2. `cartify-frontend` (auto-loaded)
**When to use**: Any frontend (React/Vite) task — modifying components, pages, or axios config.

**Capabilities**:
- Start/stop frontend: `cd Frontend && npm run dev`
- Run tests: `cd Frontend && npm test`
- Build: `cd Frontend && npx vite build`
- Apply changes to `Frontend/src/**`

### 3. `cartify-payment` (auto-loaded)
**When to use**: Payment-related tasks — Razorpay, verify-payment, webhooks.

**Key gotchas**:
- Razorpay test mode requires `rzp_test_*` keys
- Backend must have matching `RAZORPAY_KEY_ID` and frontend must have matching `VITE_RAZORPAY_KEY`
- Webhook is excluded from CSRF (`/api/payment/webhook`)
- `verify-payment` route requires valid HMAC signature

### 4. `cartify-csrf` (auto-loaded)
**When to use**: Debugging 403 Forbidden errors on state-changing requests.

**Key flow**:
1. Frontend calls `fetchCsrfToken()` on startup
2. Backend sets `csrfToken` cookie at `/api/auth/csrf-token`
3. axios interceptor reads cookie and sends as `X-CSRF-Token` header
4. Backend `csurf` middleware validates token
5. If 403, axios auto-refetches and retries once

## MCP Servers (`.opencode/mcp/`)

### 1. `mongodb-atlas` (configured)
**Tools**:
- `query` — Run MongoDB queries
- `insert` — Insert documents
- `update` — Update documents
- `delete` — Delete documents
- `list-collections` — List all collections

**Config**: Uses `MONGO_URI` from `Backend/.env`

### 2. `razorpay-test` (configured)
**Tools**:
- `create-order` — Create a Razorpay order
- `verify-payment` — Verify payment signature
- `fetch-order` — Get order details
- `refund` — Issue a refund

**Config**: Uses `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from `Backend/.env`

### 3. `frontend-dev-server` (configured)
**Tools**:
- `start` — `cd Frontend && npm run dev`
- `stop` — Kill the Vite dev server
- `status` — Check if running

### 4. `backend-dev-server` (configured)
**Tools**:
- `start` — `cd Backend && npm start`
- `stop` — Kill the Node process
- `status` — Check if running on port 5000

## When to Use What

| Task | Use |
|------|-----|
| Edit backend code | `cartify-backend` skill |
| Edit frontend code | `cartify-frontend` skill |
| Debug payment 403 | `cartify-csrf` skill |
| Query database | `mongodb-atlas` MCP |
| Test Razorpay flow | `razorpay-test` MCP |
| Restart servers | `backend-dev-server` / `frontend-dev-server` MCPs |

## Available npm Scripts

### Backend
- `npm start` — Production mode (`node server.js`)
- `npm run dev` — Dev mode (`nodemon server.js`, requires nodemon)
- `npm test` — Run Jest tests
- `npm run test:coverage` — Tests with coverage
- `node seedProducts.js` — Seed 20 products
- `node scripts/makeAdmin.js email@example.com` — Make user admin

### Frontend
- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm test` — Run Vitest tests
- `npm run test:coverage` — Tests with coverage
- `npm run test:e2e` — Playwright E2E tests

## External Tools

- **MongoDB Atlas**: https://cloud.mongodb.com (cluster management)
- **Razorpay Dashboard**: https://dashboard.razorpay.com (test mode toggle, API keys)
- **Google Cloud Console**: https://console.cloud.google.com (OAuth client config)
- **GitHub Repo**: https://github.com/surajrajput15/CARTIFY-APP
