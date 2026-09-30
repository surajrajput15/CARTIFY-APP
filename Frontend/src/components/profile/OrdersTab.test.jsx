import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}));

import OrdersTab from './OrdersTab';

const makeOrder = (status, deliveryStatus, id = 'order_9876543210') => ({
  _id: id,
  status,
  deliveryStatus,
  paymentStatus: 'Paid',
  totalPrice: 1000,
  orderItems: [
    { productId: 'p1', title: 'Blue Shirt', quantity: 2, price: 500 },
    { title: 'No Link Item', quantity: 1, price: 100 },
  ],
  shippingAddress: {
    fullName: 'Riya',
    phone: '9999999999',
    street: '1 Main St',
    city: 'Pune',
    state: 'MH',
    pinCode: '411001',
  },
});

const openDetails = () => fireEvent.click(screen.getByRole('button', { name: 'View details' }));

describe('OrdersTab details (F-16 — timeline + item links)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a timeline with past steps ticked and the current step marked', () => {
    render(<OrdersTab orders={[makeOrder('Shipped')]} loading={false} />);
    openDetails();

    const timeline = screen.getByRole('list', { name: 'Order status timeline' });
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps.map((li) => li.textContent)).toEqual([
      'Pending ✓',
      'Processing ✓',
      'Shipped (now)',
      'Delivered',
    ]);
    expect(screen.getByText('Shipped (now)').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Delivered').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('marks the first step as current for a fresh order', () => {
    render(<OrdersTab orders={[makeOrder('Pending')]} loading={false} />);
    openDetails();

    const timeline = screen.getByRole('list', { name: 'Order status timeline' });
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]).toHaveTextContent('Pending (now)');
    expect(steps[1]).toHaveTextContent('Processing');
  });

  it('replaces the timeline with a notice for a cancelled order', () => {
    render(<OrdersTab orders={[makeOrder('Cancelled')]} loading={false} />);
    openDetails();

    expect(screen.getByText('This order was cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Order status timeline' })).not.toBeInTheDocument();
  });

  it('links each item that has a productId to its product page', () => {
    render(<OrdersTab orders={[makeOrder('Delivered')]} loading={false} />);
    openDetails();

    const items = screen.getByText(/Items \(2\)/).nextElementSibling;
    expect(items).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blue Shirt' })).toHaveAttribute('href', '/product/p1');
    // Items without a productId render as plain text, not a broken link.
    expect(screen.queryByRole('link', { name: 'No Link Item' })).not.toBeInTheDocument();
  });

  it('renders Cancel Order button for cancellable orders (Pending, Processing) and opens confirmation modal', () => {
    render(<OrdersTab orders={[makeOrder('Processing')]} loading={false} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel Order' });
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);
    expect(screen.getByRole('heading', { name: 'Cancel Order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Cancel Order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Order' })).toBeInTheDocument();
  });

  it('does not render Cancel Order button for completed or shipped orders', () => {
    render(<OrdersTab orders={[makeOrder('Shipped', null, 'order_shipped_1'), makeOrder('Delivered', null, 'order_delivered_2')]} loading={false} />);
    expect(screen.queryByRole('button', { name: 'Cancel Order' })).not.toBeInTheDocument();
  });
});

