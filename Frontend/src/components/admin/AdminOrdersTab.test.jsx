import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  fetchAdminOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  refundOrder: vi.fn(),
}));

vi.mock('../../services/ordersApi', () => ({
  fetchAdminOrders: mocks.fetchAdminOrders,
  updateOrderStatus: mocks.updateOrderStatus,
  refundOrder: mocks.refundOrder,
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import AdminOrdersTab from './AdminOrdersTab';
import { formatPrice } from '../../utils/format';

const order = {
  _id: 'abcdefABC123',
  userId: { name: 'Asha Kumar', email: 'asha@example.com' },
  orderItems: [{ quantity: 2 }, { quantity: 3 }],
  totalPrice: 1499,
  paymentStatus: 'Paid',
  status: 'Processing',
  createdAt: '2026-09-01T10:00:00.000Z',
};

describe('AdminOrdersTab (F-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchAdminOrders.mockResolvedValue({ data: { orders: [order], pages: 1 } });
  });

  it('renders an order row with summed units across ALL items, not just product types', async () => {
    render(<AdminOrdersTab />);
    expect(await screen.findByText('Asha Kumar')).toBeInTheDocument();
    // 2 + 3 units across 2 distinct products — the F-07 counting bug.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/units/)).toBeInTheDocument();
    expect(screen.getByText(/\(2 products\)/)).toBeInTheDocument();
    expect(screen.getByText(formatPrice(1499))).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('offers only current + next statuses and calls updateOrderStatus on change', async () => {
    mocks.updateOrderStatus.mockResolvedValue({});
    mocks.fetchAdminOrders.mockResolvedValueOnce({ data: { orders: [order], pages: 1 } })
      .mockResolvedValueOnce({ data: { orders: [{ ...order, status: 'Shipped' }], pages: 1 } });

    render(<AdminOrdersTab />);
    const select = await screen.findByLabelText('Change status for order ABC123');

    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['Processing', 'Shipped', 'Cancelled']);

    fireEvent.change(select, { target: { value: 'Shipped' } });

    await waitFor(() =>
      expect(mocks.updateOrderStatus).toHaveBeenCalledWith('abcdefABC123', 'Shipped')
    );
    await waitFor(() => expect(mocks.fetchAdminOrders).toHaveBeenCalledTimes(2));
  });

  it('routes Paid orders through the refund confirmation dialog', async () => {
    mocks.refundOrder.mockResolvedValue({});
    render(<AdminOrdersTab />);

    fireEvent.click(await screen.findByLabelText('Refund order ABC123'));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm Refund' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    await waitFor(() => expect(mocks.refundOrder).toHaveBeenCalledWith('abcdefABC123'));
  });

  it('shows a neutral empty state when the filter matches nothing', async () => {
    mocks.fetchAdminOrders.mockResolvedValue({ data: { orders: [], pages: 1 } });
    render(<AdminOrdersTab />);
    expect(await screen.findByText(/No orders found/)).toBeInTheDocument();
  });
});
