# Sprint 3

---

# Day 1

## Objective

Improve architecture, maintainability, and performance without changing application behavior.

## Completed

- Refactored large pages into reusable components
- Introduced custom hooks
- Added shared UI components
- Implemented route-based code splitting using React.lazy + Suspense
- Added global ErrorBoundary
- Created reusable API service layer
- Performed memoization audit and optimized unnecessary re-renders
- Reduced component sizes significantly
- Verified production build passes successfully

## Files Created

### Shared UI Components

- `src/components/EmptyState.jsx`
- `src/components/ErrorBoundary.jsx`
- `src/components/Spinner.jsx`
- `src/components/StockBadge.jsx`

### Admin Components

- `src/components/admin/AdminHeader.jsx`
- `src/components/admin/AdminFilterBar.jsx`
- `src/components/admin/ProductTable.jsx`
- `src/components/admin/ProductFormModal.jsx`

### Checkout Components

- `src/components/checkout/AddressSelector.jsx`
- `src/components/checkout/OrderSummary.jsx`

### Profile Components

- `src/components/profile/ProfileSidebar.jsx`
- `src/components/profile/ProfileInfo.jsx`
- `src/components/profile/OrdersTab.jsx`
- `src/components/profile/AddressManager.jsx`
- `src/components/profile/SettingsTab.jsx`

### Custom Hooks

- `src/hooks/useAdminProducts.js`
- `src/hooks/useOrders.js`
- `src/hooks/useAddresses.js`
- `src/hooks/useProfile.js`
- `src/hooks/useRazorpayPayment.js`

### API Services

- `src/services/productsApi.js`
- `src/services/ordersApi.js`
- `src/services/addressesApi.js`
- `src/services/authApi.js`

### Utilities & Data

- `src/utils/products.js`
- `src/data/seedProducts.js`

## Files Modified

- `src/App.jsx` — Route-based code splitting using `React.lazy` + `Suspense`
- `src/main.jsx` — Added global `ErrorBoundary`
- `src/context/cartContext.jsx` — Memoization improvements (stable callbacks + memoized value)
- `src/components/LoginFormComponents/GoogleLoginButton.jsx` — Uses `authApi`
- `src/pages/AdminPage.jsx` — Refactored into reusable components and hooks
- `src/pages/CartPage.jsx` — Optimized totals using `useMemo`
- `src/pages/CheckoutPage.jsx` — Uses `ordersApi` and optimized calculations
- `src/pages/HomePage.jsx` — Uses `productsApi`
- `src/pages/LoginPage.jsx` — Uses `authApi`
- `src/pages/ProductDetailsPage.jsx` — Uses `productsApi` and shared `StockBadge`
- `src/pages/ProfilePage.jsx` — Refactored into reusable profile components

## Build Status

- ✅ `npm run build` Passed

## Lint Status

- No new lint issues introduced

## Result

- Cleaner architecture
- Better maintainability
- Improved code reusability
- Better bundle loading through lazy loading
- Ready for security hardening

---

# Day 2

## Objective

Strengthen authentication and authorization to production-grade security standards.

## Completed

### Google OAuth Security

- Installed Google's official `google-auth-library`
- Frontend now sends the original Google ID Token (`credential`)
- Removed client-side trusted authentication flow
- Backend now verifies Google ID Token using `OAuth2Client.verifyIdToken()`
- Implemented validation for:
  - Token signature
  - Audience (`GOOGLE_CLIENT_ID`)
  - Issuer
  - Expiration
  - `email_verified`
- Backend now creates/authenticates users only from Google's verified payload
- Removed dependency on client-provided `{ name, email }`
- Added backend startup validation for `GOOGLE_CLIENT_ID`
- Authentication bypass using forged `{ name, email }` requests is no longer possible

### Admin Privilege Hardening

- Removed automatic admin creation from:
  - OTP Login
  - Password Registration
  - Google Login
- Removed all `userCount === 0` privilege assignment logic
- New users now always inherit the schema default:
  - `isAdmin: false`
- Existing admin accounts remain unchanged
- Admin promotion is now possible only through:
  - `scripts/makeAdmin.js`
- Eliminated automatic privilege escalation

## Files Modified

### Backend

- `Backend/routes/authRoutes.js`
  - Added Google ID Token verification
  - Removed client-trusted authentication
  - Removed automatic admin assignment

- `Backend/server.js`
  - Added `GOOGLE_CLIENT_ID` environment validation

- `Backend/.env.example`
  - Added documentation for `GOOGLE_CLIENT_ID`

### Frontend

- `Frontend/src/components/LoginFormComponents/GoogleLoginButton.jsx`
  - Sends Google credential instead of decoded profile

## Security Improvements

- Prevented Google authentication bypass
- Prevented account takeover using forged email payloads
- Prevented automatic privilege escalation
- Authentication now follows Google's official verification flow
- Admin creation is now explicit and controlled
- Improved production security posture

## Build Status

- ✅ Backend syntax validation passed
- ✅ Frontend production build passed

## Verification

Verified that:

- Invalid Google credentials are rejected
- Forged `{ name, email }` requests cannot authenticate
- New users can no longer become administrators automatically
- Existing authentication flows (OTP, Password, JWT) continue to work correctly

## Result

Authentication and authorization have been hardened to production-grade standards. The application now follows secure Google OAuth practices and eliminates automatic privilege escalation.

---

# Sprint 3 Progress

## Completed

### Architecture
- Large component refactoring
- Custom hooks
- Shared UI components
- API service layer
- React.lazy + Suspense
- Global ErrorBoundary
- Memoization improvements

### Security
- Google OAuth verification
- Server-side ID Token validation
- Environment validation
- Authentication hardening
- Removed automatic admin creation
- Explicit admin promotion only

## Current Status

**Sprint 3 Progress: ~65% Complete**

## Remaining Work

- Performance optimization
- React rendering optimization
- Database optimization
- Final production polish
- Lighthouse optimization
- Final production audit
- Release documentation