# Frontend Skill

## When to use
Any task involving the React/Vite frontend — modifying components, pages, or axios config.

## Key files
- `Frontend/src/main.jsx` — App entry point
- `Frontend/src/App.jsx` — Router setup with error boundaries
- `Frontend/src/api/axios.js` — Centralized HTTP client with CSRF + 401 refresh
- `Frontend/src/context/` — AuthProvider, CartProvider, BackendStatusProvider
- `Frontend/src/pages/` — 8 page components
- `Frontend/src/components/` — 15+ shared components
- `Frontend/src/utils/` — Helpers (format, apiError, etc.)

## How to start the frontend
```bash
cd Frontend
npm run dev          # Start Vite dev server
```

Vite auto-picks port: 5173, 5174, 5175... Check terminal output. Open browser to that URL.

## How to run tests
```bash
cd Frontend
npm test                    # All tests
npm run test:coverage       # With coverage
```

Current: 26 tests passing.

## How to build
```bash
cd Frontend
npm run build              # Production build → dist/
npm run preview            # Preview production build locally
```

## Environment Variables
Read from `Frontend/.env` (must start with `VITE_`):
- `VITE_API_URL=http://localhost:5000`
- `VITE_RAZORPAY_KEY` — Must match backend `RAZORPAY_KEY_ID` (test mode)
- `VITE_GOOGLE_CLIENT_ID` — Must match backend `GOOGLE_CLIENT_ID`
- `VITE_SENTRY_DSN` — Optional, Sentry error tracking

## CSRF Flow (critical!)
1. `Frontend/src/main.jsx` calls `fetchCsrfToken()` on app startup
2. `Frontend/src/api/axios.js` has a request interceptor that adds `X-CSRF-Token` header
3. `Frontend/src/api/axios.js` has a response interceptor that retries on 403 (re-fetches token)

If you see CSRF errors in console:
1. Check `axios.js` has `fetchCsrfToken` exported and `getCsrfToken` reads `csrfToken` cookie
2. Check `main.jsx` calls `fetchCsrfToken()` on startup
3. Check `Backend/server.js` has `/api/auth/csrf-token` in excluded paths

## Key Components

### `BackendStatusBanner` (`.opencode/../Frontend/src/components/BackendStatusBanner.jsx`)
Shows a yellow banner at top of page when backend is unreachable. Dismissible.

### `ProductCard` (`Frontend/src/components/ProductCard.jsx`)
Memoized with `React.memo`. Displays product image, price, stock badge, add-to-cart button.

### `Navbar` (`Frontend/src/components/Navbar.jsx`)
Shows logo, search bar, login/profile, cart with item count. Cart count has `aria-live="polite"` for accessibility.

### `HeroBanner` (`Frontend/src/components/HeroBanner.jsx`)
Fetches real product count from API. Falls back to "1000+ curated products" if API fails.

## Common frontend tasks

### Add a new page
1. Create `Frontend/src/pages/YourPage.jsx`
2. Add route in `Frontend/src/App.jsx`
3. Use lazy loading: `const YourPage = lazy(() => import('./pages/YourPage'));`

### Add a new component
1. Create `Frontend/src/components/YourComponent.jsx`
2. Use `memo` for performance: `export default memo(function YourComponent() {...});`
3. Use `useCallback` for event handlers
4. Use `useMemo` for expensive computations

### Fix CSRF errors
1. Check `axios.js` has `getCsrfToken` and `fetchCsrfToken`
2. Check `main.jsx` calls `fetchCsrfToken()` on startup
3. Check `Backend/server.js` has CSRF exclusions

## Styling
- Tailwind CSS 4 (utility-first)
- Custom theme color: teal (`bg-teal-600`, `text-teal-700`, etc.)
- Responsive: `sm:`, `md:`, `lg:`, `xl:` breakpoints
- Icons: `lucide-react`
- Toast: `react-hot-toast`

## Common Gotchas
- **Vite port conflict**: Vite auto-picks next port. Check terminal.
- **CORS errors**: Check `VITE_API_URL` matches backend `cors` config
- **CSRF 403**: See CSRF flow above
- **Build errors**: Check `npm run build` for specific errors
- **Hot reload not working**: Restart Vite dev server

## Testing Patterns
- Use Vitest (not Jest)
- Test files: `*.test.js` or `*.test.jsx` next to source
- Coverage: `npm run test:coverage`
- E2E: `npm run test:e2e` (Playwright)

## Performance
- Code splitting via `React.lazy()`
- Memoization: `React.memo`, `useCallback`, `useMemo`
- Image optimization: `loading="lazy"`, `decoding="async"`
- Bundle analysis: `dist/stats.html` after build
