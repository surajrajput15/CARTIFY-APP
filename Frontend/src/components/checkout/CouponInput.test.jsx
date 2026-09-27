import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CouponInput from './CouponInput';
import { fetchAvailableCoupons } from '../../services/couponsApi';

vi.mock('../../services/couponsApi', () => ({
  fetchAvailableCoupons: vi.fn(),
  validateCoupon: vi.fn(),
  findBestCoupon: vi.fn(),
}));

const couponFixture = (overrides = {}) => ({
  code: 'SAVE20',
  type: 'percentage',
  value: 20,
  discount: 200,
  minOrderAmount: 500,
  maxDiscount: 300,
  applicableCategories: [],
  applicableProducts: [],
  excludedProducts: [],
  validUntil: '2030-01-01',
  ...overrides,
});

const baseProps = {
  code: '',
  setCode: vi.fn(),
  applied: null,
  loading: false,
  error: '',
  onApply: vi.fn(),
  onRemove: vi.fn(),
  onFindBest: vi.fn().mockResolvedValue(undefined),
  bestLoading: false,
};

const openBestCoupon = async () => {
  fireEvent.click(screen.getByRole('button', { name: /view and apply the best available coupon/i }));
  // handleFindBest is async: it awaits onFindBest before revealing the modal.
  await act(async () => { await Promise.resolve(); });
};

// Regression guard for the production crash:
//   TypeError: Cannot read properties of undefined (reading 'map')
//   at useMemo (vendor-react) ... CouponInput chunk
// CartPage rendered <CouponInput /> without `cart` / `totalAmount`. The modal is
// mounted unconditionally, so `undefined` reached useCoupon's cartKey memo and
// took down the whole cart page.
describe('CouponInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAvailableCoupons.mockResolvedValue({ data: { coupons: [] } });
  });

  it('renders without cart/totalAmount props and does not throw', () => {
    expect(() => render(<CouponInput {...baseProps} />)).not.toThrow();
    expect(screen.getByText(/have a coupon\?/i)).toBeInTheDocument();
  });

  it('does not fetch coupons while the modal is closed', async () => {
    render(<CouponInput {...baseProps} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchAvailableCoupons).not.toHaveBeenCalled();
  });

  it('opens the coupon list with an empty payload instead of crashing on undefined', async () => {
    render(<CouponInput {...baseProps} />);
    await openBestCoupon();

    await waitFor(() => expect(fetchAvailableCoupons).toHaveBeenCalledTimes(1));
    expect(fetchAvailableCoupons).toHaveBeenCalledWith(0, []);
    expect(await screen.findByText(/available coupons/i)).toBeInTheDocument();
    expect(await screen.findByText(/no coupons available for this cart/i)).toBeInTheDocument();
  });

  it('passes the real cart into the request when props are supplied', async () => {
    const cart = [{ _id: 'p1', quantity: 2, price: 500, category: 'electronics' }];
    render(<CouponInput {...baseProps} cart={cart} totalAmount={1000} />);
    await openBestCoupon();

    await waitFor(() => expect(fetchAvailableCoupons).toHaveBeenCalledWith(1000, [
      { productId: 'p1', quantity: 2, category: 'electronics' },
    ]));
  });

  it('applies the code the user clicked, forwarded with the code as an argument', async () => {
    const onApply = vi.fn();
    fetchAvailableCoupons.mockResolvedValue({ data: { coupons: [couponFixture()] } });
    render(
      <CouponInput
        {...baseProps}
        onApply={onApply}
        cart={[{ _id: 'p1', quantity: 1, price: 1000 }]}
        totalAmount={1000}
      />
    );
    await openBestCoupon();

    fireEvent.click(await screen.findByRole('button', { name: /apply SAVE20 - save/i }));
    // Not called with no argument: the modal hands the picked code to the
    // parent so the right coupon is validated.
    expect(onApply).toHaveBeenCalledWith('SAVE20');
  });

  it('renders the list when the API returns coupons', async () => {
    fetchAvailableCoupons.mockResolvedValue({
      data: { coupons: [couponFixture({ code: 'FLAT50', type: 'flat', value: 50, discount: 50, maxDiscount: null })] },
    });
    render(<CouponInput {...baseProps} cart={[{ _id: 'p1', quantity: 1, price: 500 }]} totalAmount={500} />);
    await openBestCoupon();

    expect(await screen.findByText('FLAT50')).toBeInTheDocument();
  });

  it('shows an error with a working retry when the request fails', async () => {
    fetchAvailableCoupons
      .mockRejectedValueOnce({ response: { data: { message: 'Network down' } } })
      .mockResolvedValueOnce({ data: { coupons: [] } });
    render(<CouponInput {...baseProps} cart={[{ _id: 'p1', quantity: 1, price: 500 }]} totalAmount={500} />);
    await openBestCoupon();

    expect(await screen.findByText('Network down')).toBeInTheDocument();

    // The old Try again button was an empty no-op handler.
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(fetchAvailableCoupons).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/no coupons available for this cart/i)).toBeInTheDocument();
  });

  it('shows the applied coupon and removes it', async () => {
    const onRemove = vi.fn();
    render(
      <CouponInput
        {...baseProps}
        onRemove={onRemove}
        applied={couponFixture()}
        cart={[{ _id: 'p1', quantity: 1, price: 1000 }]}
        totalAmount={1000}
      />
    );

    expect(screen.getByText('SAVE20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove coupon SAVE20/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
