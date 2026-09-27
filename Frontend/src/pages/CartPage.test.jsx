import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const state = vi.hoisted(() => ({
  cart: [],
  user: null,
  updateQuantity: vi.fn(),
  removeFromCart: vi.fn(),
}));

vi.mock('../context/cartContext', () => ({
  useCart: () => ({
    cart: state.cart,
    updateQuantity: state.updateQuantity,
    removeFromCart: state.removeFromCart,
    addToCart: vi.fn(),
  }),
}));
vi.mock('../context/authContext', () => ({ useAuth: () => ({ user: state.user }) }));
// F-33: CartPage now reads the shared provider instead of calling useCoupon directly
vi.mock('../context/couponContext', () => ({
  useSharedCoupon: () => ({
    code: '',
    setCode: vi.fn(),
    applied: null,
    loading: false,
    error: null,
    applyCoupon: vi.fn(),
    applyBestCoupon: vi.fn(),
    bestLoading: false,
    clearCoupon: vi.fn(),
  }),
}));
vi.mock('../components/checkout/CouponInput', () => ({
  default: () => <div data-testid="coupon-input" />,
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, onClick, ...rest }) => <a href={to} onClick={onClick} {...rest}>{children}</a>,
}));

import CartPage from './CartPage';

const item = (quantity) => ({
  _id: 'p1',
  title: 'Blue Shirt',
  price: 500,
  quantity,
  countInStock: 10,
  image: 'shirt.jpg',
});

const customer = { id: 'u1', name: 'Riya' };

describe('CartPage quantity controls (F-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = customer;
  });

  it('disables the minus button at quantity 1', () => {
    state.cart = [item(1)];
    render(<CartPage />);

    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).not.toBeDisabled();
  });

  it('keeps the minus button enabled above quantity 1 and wires it to updateQuantity', () => {
    state.cart = [item(3)];
    render(<CartPage />);

    const minus = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(minus).not.toBeDisabled();
    fireEvent.click(minus);
    expect(state.updateQuantity).toHaveBeenCalledWith('p1', 'decrease', null);
  });

  it('does not call updateQuantity when the disabled minus button is clicked', () => {
    state.cart = [item(1)];
    render(<CartPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(state.updateQuantity).not.toHaveBeenCalled();
  });
});

describe('CartPage coupon visibility (F-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cart = [item(2)];
  });

  it('hides the coupon input from guests and offers a login hint instead', () => {
    state.user = null;
    render(<CartPage />);

    expect(screen.queryByTestId('coupon-input')).not.toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /log in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('sends returning guests back to the cart after login', () => {
    state.user = null;
    render(<CartPage />);

    fireEvent.click(screen.getByRole('link', { name: /log in/i }));
    expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/cart');
  });

  it('shows the coupon input to signed-in users', () => {
    state.user = customer;
    render(<CartPage />);

    expect(screen.getByTestId('coupon-input')).toBeInTheDocument();
    expect(screen.queryByText(/log in to apply a coupon/i)).not.toBeInTheDocument();
  });
});
