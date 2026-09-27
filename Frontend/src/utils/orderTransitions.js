// Admin order status transitions offered by the UI.
// MUST mirror ALLOWED_TRANSITIONS in Backend/routes/orderRoutes.js — the
// server rejects any transition outside its map, so offering a status here
// that the API refuses would fail only at click time. Update both together
// (locked by orderTransitions.test.js).
export const ORDER_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

// The select offers the current status plus its next states, so an order can
// never jump backwards (e.g. Delivered → Pending) via the UI.
export const nextStatuses = (status) => [status, ...(ORDER_TRANSITIONS[status] || [])];
