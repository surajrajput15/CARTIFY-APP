import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddressSelector from './AddressSelector';

vi.mock('../profile/LocationPicker', () => ({
  default: () => <div data-testid="location-picker-mock">LocationPicker Mock</div>,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseProps = {
  addresses: [],
  loading: false,
  selectedAddress: null,
  onSelect: vi.fn(),
  onGoToProfile: vi.fn(),
  onSaveAddress: vi.fn(),
};

describe('AddressSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state without crashing when there are no addresses', () => {
    render(<AddressSelector {...baseProps} />);
    expect(screen.getByText(/you don't have any saved addresses yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add address in profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add delivery address$/i })).toBeInTheDocument();
  });

  it('renders loading placeholders while loading', () => {
    render(<AddressSelector {...baseProps} loading />);
    expect(screen.getByLabelText('Loading addresses')).toBeInTheDocument();
  });

  it('renders a list of saved addresses and selects one', () => {
    const onSelect = vi.fn();
    const addresses = [
      {
        _id: 'a1',
        fullName: 'Suraj Kumar',
        street: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
        phone: '9876543210',
        addressType: 'Home',
        isDefault: true,
      },
      {
        _id: 'a2',
        fullName: 'Office User',
        street: '45 Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560100',
        phone: '9876543211',
        addressType: 'Work',
      },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} selectedAddress={addresses[0]} onSelect={onSelect} />);
    expect(screen.getByRole('radio', { name: /suraj kumar, 12 mg road, bengaluru/i })).toBeInTheDocument();

    const secondRadio = screen.getByRole('radio', { name: /office user, 45 tech park, bengaluru/i });
    fireEvent.click(secondRadio);
    expect(onSelect).toHaveBeenCalledWith(addresses[1]);
  });

  it('shows an error panel instead of the empty state when the fetch failed', () => {
    const onRetry = vi.fn();
    render(<AddressSelector {...baseProps} error="Failed to load addresses" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/you don't have any saved addresses yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps showing cached addresses when a refetch fails', () => {
    const addresses = [
      { _id: 'a1', fullName: 'Suraj Kumar', street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', phone: '9876543210' },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} error="Failed to load addresses" />);
    expect(screen.getByRole('radio', { name: /suraj kumar/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when selected address has invalid phone or pin code', () => {
    const addresses = [
      { _id: 'a1', fullName: 'Suraj Kumar', street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '123', phone: '12345' },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} selectedAddress={addresses[0]} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/invalid delivery details on selected address/i)).toBeInTheDocument();
  });

  it('opens and closes the Add Address modal from header action', () => {
    const addresses = [
      { _id: 'a1', fullName: 'Suraj Kumar', street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', phone: '9876543210' },
    ];
    render(<AddressSelector {...baseProps} addresses={addresses} selectedAddress={addresses[0]} />);
    
    const addBtn = screen.getByRole('button', { name: /add new address/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog', { name: /add delivery address/i })).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog', { name: /add delivery address/i })).not.toBeInTheDocument();
  });

  it('validates phone and PIN code before submitting address', async () => {
    const onSaveAddress = vi.fn();
    render(<AddressSelector {...baseProps} onSaveAddress={onSaveAddress} />);

    // Open modal from empty state button
    fireEvent.click(screen.getByRole('button', { name: /^add delivery address$/i }));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText(/street \/ flat \/ colony/i), { target: { value: '10 Downing St' } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: '400' } });

    fireEvent.click(screen.getByRole('button', { name: /save & deliver here/i }));

    expect(screen.getByText(/enter a valid 10-digit indian phone number/i)).toBeInTheDocument();
    expect(onSaveAddress).not.toHaveBeenCalled();

    // Fix phone number to valid 10-digit
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /save & deliver here/i }));

    expect(screen.getByText(/enter a valid 6-digit pin code/i)).toBeInTheDocument();
    expect(onSaveAddress).not.toHaveBeenCalled();
  });

  it('successfully saves address and auto-selects newly created address', async () => {
    const savedAddress = {
      _id: 'new-123',
      fullName: 'Rahul Sharma',
      phone: '9876543210',
      street: 'Flat 402, Lotus Heights',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      addressType: 'Work',
    };
    const onSaveAddress = vi.fn().mockResolvedValue(savedAddress);
    const onSelect = vi.fn();

    render(<AddressSelector {...baseProps} onSaveAddress={onSaveAddress} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /^add delivery address$/i }));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Rahul Sharma' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/street \/ flat \/ colony/i), { target: { value: 'Flat 402, Lotus Heights' } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: '411001' } });

    fireEvent.click(screen.getByRole('button', { name: /save & deliver here/i }));

    await waitFor(() => {
      expect(onSaveAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Rahul Sharma',
          phone: '9876543210',
          street: 'Flat 402, Lotus Heights',
          city: 'Pune',
          state: 'Maharashtra',
          pinCode: '411001',
        })
      );
    });

    expect(onSelect).toHaveBeenCalledWith(savedAddress);
    expect(screen.queryByRole('dialog', { name: /add delivery address/i })).not.toBeInTheDocument();
  });

  it('displays API error without resetting entered form data when save fails', async () => {
    const onSaveAddress = vi.fn().mockRejectedValue({
      response: { data: { message: 'Address limit exceeded on account' } },
    });

    render(<AddressSelector {...baseProps} onSaveAddress={onSaveAddress} />);

    fireEvent.click(screen.getByRole('button', { name: /^add delivery address$/i }));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Sunil Kumar' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9812345678' } });
    fireEvent.change(screen.getByLabelText(/street \/ flat \/ colony/i), { target: { value: '22 Park Street' } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Kolkata' } });
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'West Bengal' } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: '700016' } });

    fireEvent.click(screen.getByRole('button', { name: /save & deliver here/i }));

    await waitFor(() => {
      expect(screen.getByText('Address limit exceeded on account')).toBeInTheDocument();
    });

    // Verify entered inputs are preserved
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Sunil Kumar');
    expect(screen.getByLabelText(/street \/ flat \/ colony/i)).toHaveValue('22 Park Street');
  });
});