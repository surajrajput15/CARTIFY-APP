import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderTrackingPage from './OrderTrackingPage';
import { fetchOrderById } from '../services/ordersApi';
import { useAuth } from '../context/authContext';
import { useLiveTracking } from '../hooks/useLiveTracking';

vi.mock('../services/ordersApi', () => ({
  fetchOrderById: vi.fn(),
}));

vi.mock('../context/authContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useLiveTracking', () => ({
  useLiveTracking: vi.fn(),
}));

vi.mock('../components/map/MapContainer', () => ({
  MapContainer: (props) => (
    <div data-testid="map-container" data-center={JSON.stringify(props.center)} data-show-dest={String(props.showDestination)}>
      MapContainer
    </div>
  ),
}));

describe('OrderTrackingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test User' },
      authLoading: false,
    });
    useLiveTracking.mockReturnValue({
      position: null,
      deliveryStatus: 'out_for_delivery',
      connected: true,
      error: null,
    });
  });

  const renderPage = (orderId = 'order-123') => {
    return render(
      <MemoryRouter initialEntries={[`/track/${orderId}`]}>
        <Routes>
          <Route path="/track/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders graceful fallback when neither destination nor courier coordinates exist', async () => {
    fetchOrderById.mockResolvedValue({
      data: {
        _id: 'order-123',
        deliveryStatus: 'out_for_delivery',
        shippingAddress: {
          fullName: 'Rajesh Kumar',
          street: '12 Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pinCode: '110001',
          // No latitude / longitude
        },
        orderItems: [],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Map View Unavailable')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/delivery address ke map coordinates available nahi hain/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('renders map centered on valid destination coordinates', async () => {
    fetchOrderById.mockResolvedValue({
      data: {
        _id: 'order-123',
        deliveryStatus: 'out_for_delivery',
        shippingAddress: {
          fullName: 'Rajesh Kumar',
          street: '12 Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pinCode: '110001',
          latitude: 28.6315,
          longitude: 77.2167,
        },
        orderItems: [],
      },
    });

    renderPage();

    await waitFor(() => {
      const map = screen.getByTestId('map-container');
      expect(map).toBeInTheDocument();
      expect(map).toHaveAttribute('data-center', JSON.stringify([28.6315, 77.2167]));
      expect(map).toHaveAttribute('data-show-dest', 'true');
    });
  });

  it('renders courier position with disclaimer when destination coordinates are missing', async () => {
    fetchOrderById.mockResolvedValue({
      data: {
        _id: 'order-123',
        deliveryStatus: 'out_for_delivery',
        shippingAddress: {
          fullName: 'Rajesh Kumar',
          street: '12 Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pinCode: '110001',
          // Missing lat/lng
        },
        orderItems: [],
      },
    });

    useLiveTracking.mockReturnValue({
      position: { latitude: 28.62, longitude: 77.21, updatedAt: new Date().toISOString() },
      deliveryStatus: 'out_for_delivery',
      connected: true,
      error: null,
    });

    renderPage();

    await waitFor(() => {
      const map = screen.getByTestId('map-container');
      expect(map).toBeInTheDocument();
      expect(map).toHaveAttribute('data-center', JSON.stringify([28.62, 77.21]));
      expect(map).toHaveAttribute('data-show-dest', 'false');
    });

    expect(
      screen.getByText(/delivery address coordinates unavailable\. showing courier's live location/i)
    ).toBeInTheDocument();
  });
});
