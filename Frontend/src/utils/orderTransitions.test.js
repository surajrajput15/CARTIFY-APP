import { describe, it, expect } from 'vitest';
import { ORDER_TRANSITIONS, nextStatuses } from './orderTransitions';

// Verbatim copy of ALLOWED_TRANSITIONS in Backend/routes/orderRoutes.js.
// If the backend map changes, update src/utils/orderTransitions.js to match
// (and this copy) — the admin UI must never offer a status the API rejects.
const BACKEND_ALLOWED_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

describe('orderTransitions (F-07 — mirrors backend ALLOWED_TRANSITIONS)', () => {
  it('matches the backend transition map exactly', () => {
    expect(ORDER_TRANSITIONS).toEqual(BACKEND_ALLOWED_TRANSITIONS);
  });

  it('offers the current status plus its next states', () => {
    expect(nextStatuses('Pending')).toEqual(['Pending', 'Processing', 'Cancelled']);
    expect(nextStatuses('Shipped')).toEqual(['Shipped', 'Delivered', 'Cancelled']);
  });

  it('offers no transition out of terminal states', () => {
    expect(nextStatuses('Delivered')).toEqual(['Delivered']);
    expect(nextStatuses('Cancelled')).toEqual(['Cancelled']);
  });
});
