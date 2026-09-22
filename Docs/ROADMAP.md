# Cartify Roadmap

## ✅ Phase 1
Frontend UI

---

## ✅ Phase 2
Full Stack Integration

---

## ✅ Phase 3
Engineering for Production

Status: Complete

---

## ✅ Phase 4
QA & Reliability

- Automated unit tests (Vitest) for core utilities, cart logic & image URL resolution
- Server-side cart sync with merge-on-login (cross-device persistence)
- Cloudinary image storage (optional, env-flagged with local fallback)
- a11y hardening (focus-trapped modals, skip link, aria-live toasts, labeled icons)

---

## 🚧 Phase 5
Frontend Deep Audit & Remediation

Status: **Planned** — see [`FRONTEND-AUDIT-TODOS.md`](./FRONTEND-AUDIT-TODOS.md)

- 58 tracked tasks across 7 phases (4 × P0, 9 × P1, 33 × P2, 12 × P3)
- P0: money-display mismatch, cross-user cart/coupon leak, stale address list, red CI lint job
- Phase 2: user-flow correctness (URL-driven filters, route guards, order details, double-click)
- Phase 3: responsive pass at 8 breakpoints
- Phase 4: design-system extraction (shared `ui/` primitives, one placeholder image)
- Phase 5: accessibility (modal ARIA fix, contrast, autofill)
- Phase 6: performance (cart context split, remove/activate Sentry)
- Phase 7: tooling, data authenticity, docs
- 4 blocking decisions (shipping rule, logout cart policy, address-work scope, TS strategy)

---

## Upcoming

Phase 6