import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderConfirmationPage from './OrderConfirmationPage';
import * as ordersApi from '../services/ordersApi';

vi.mock('../services/ordersApi');

const mockOrder = {
  _id: '675123456789abcdef012345',
  createdAt: '2026-09-30T10:00:00.000Z',
  paymentStatus: 'Paid',
  status: 'Processing',
  totalPrice: 1299,
  originalTotal: 1599,
  discountAmount: 300,
  couponCode: 'SAVE300',
  razorpayPaymentId: 'pay_ABC123xyz',
  orderItems: [
    {
      productId: 'p_101',
      title: 'Premium Wireless Headphones',
      price: 1299,
      quantity: 1,
      variantColor: 'Matte Black',
      image: 'https://example.com/headphones.jpg'
    }
  ],
  shippingAddress: {
    fullName: 'Jane Doe',
    phone: '9876543210',
    street: '42 Tech Park Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001'
  }
};

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders order confirmation details including order number, items, and total paid', async () => {
    vi.spyOn(ordersApi, 'fetchOrderById').mockResolvedValue({ data: mockOrder });

    render(
      <MemoryRouter initialEntries={['/order-confirmation/675123456789abcdef012345']}>
        <Routes>
          <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Thank you for your order!')).toBeInTheDocument();
    });

    expect(screen.getByText(/Order #ef012345 Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText('Premium Wireless Headphones')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,299.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/42 Tech Park Road/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Track Delivery Live/i })).toHaveAttribute(
      'href',
      '/track/675123456789abcdef012345'
    );
  });

  it('renders error state when order cannot be found', async () => {
    vi.spyOn(ordersApi, 'fetchOrderById').mockRejectedValue({
      response: { data: { message: 'Order not found' } }
    });

    render(
      <MemoryRouter initialEntries={['/order-confirmation/unknown_order_id']}>
        <Routes>
          <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Order Not Found')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Go to My Orders' })).toHaveAttribute(
      'href',
      '/profile?tab=orders'
    );
  });
});
