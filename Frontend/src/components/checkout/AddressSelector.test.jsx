import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddressSelector from './AddressSelector';

const baseProps = {
  addresses: [],
  loading: false,
  selectedAddress: null,
  onSelect: vi.fn(),
  onGoToProfile: vi.fn(),
};

describe('AddressSelector', () => {
  it('renders the empty state without crashing when there are no addresses', () => {
    render(<AddressSelector {...baseProps} />);
    expect(screen.getByText(/you don't have any saved addresses yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add address in profile/i })).toBeInTheDocument();
  });

  it('renders loading placeholders while loading', () => {
    render(<AddressSelector {...baseProps} loading />);
    expect(screen.getByLabelText('Loading addresses')).toBeInTheDocument();
  });

  it('renders a list of saved addresses', () => {
    const addresses = [
      {
        _id: 'a1',
        fullName: 'Suraj Kumar',
        street: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
        phone: '9876543210',
      },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} selectedAddress={addresses[0]} />);
    expect(screen.getByRole('radio', { name: /suraj kumar, 12 mg road, bengaluru/i })).toBeInTheDocument();
  });

  it('shows an error panel instead of the empty state when the fetch failed', () => {
    const onRetry = vi.fn();
    render(<AddressSelector {...baseProps} error="Failed to load addresses" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/you don't have any saved addresses yet/i)).not.toBeInTheDocument();
  });

  it('keeps showing cached addresses when a refetch fails', () => {
    const addresses = [
      { _id: 'a1', fullName: 'Suraj Kumar', street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', phone: '9876543210' },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} error="Failed to load addresses" />);
    expect(screen.getByRole('radio', { name: /suraj kumar/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});