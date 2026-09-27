import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatPrice } from '../../utils/format';
import OrderSummary from './OrderSummary';

// DEC-1A / F-02: the backend never charges shipping (paymentRoutes computes
// total = items − discount only), so no screen may add ₹79 client-side.
describe('OrderSummary — displayed total equals charged total (DEC-1A)', () => {
  it('shows the discounted subtotal as the total — never subtotal + shipping', () => {
    render(<OrderSummary total={500} />);

    // Subtotal row and Total row both show exactly ₹500.00…
    expect(screen.getAllByText(formatPrice(500)).length).toBeGreaterThanOrEqual(2);
    // …and nothing anywhere shows the old ₹500 + ₹79 = ₹579.
    expect(screen.queryByText(/579/)).toBeNull();
  });

  it('renders the free-shipping note as marketing copy, not a money row', () => {
    render(<OrderSummary total={500} />);

    expect(screen.getByText('Add ₹499 for free shipping')).toBeInTheDocument();
    // No standalone ₹79 amount is rendered anywhere in the summary.
    expect(screen.queryByText(/^₹79(\.00)?$/)).toBeNull();
  });

  it('keeps the Pay CTA label in sync with the amount the backend will charge', () => {
    render(<OrderSummary total={500} />);

    expect(
      screen.getByRole('button', { name: `Pay ${formatPrice(500)} now` })
    ).toBeInTheDocument();
  });

  it('applies the coupon discount before displaying the total', () => {
    render(<OrderSummary total={500} discount={50} />);

    expect(screen.getAllByText(formatPrice(450)).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/529/)).toBeNull(); // old 450 + 79
  });
});
