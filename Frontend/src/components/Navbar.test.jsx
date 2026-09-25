import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Navbar from './Navbar';

const authState = { user: null, logout: vi.fn() };

vi.mock('react-router-dom', () => ({
  NavLink: ({ to, children, className, ...rest }) => {
    const resolved = typeof className === 'function' ? className({ isActive: false }) : className;
    return <a href={to} className={resolved} {...rest}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

vi.mock('../context/cartContext', () => ({ useCart: () => ({ cart: [] }) }));
vi.mock('../context/WishlistContext', () => ({ useWishlist: () => ({ wishlist: [] }) }));
vi.mock('../context/authContext', () => ({ useAuth: () => authState }));
vi.mock('../services/categoriesApi', () => ({
  fetchCategories: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock('./SearchBox', () => ({ default: () => <input aria-label="Search products" /> }));
vi.mock('./LocationBar', () => ({ default: () => <span>Location</span> }));

const customer = { name: 'Riya Sharma', role: 'customer', isAdmin: false };
const owner = { name: 'Suraj Kumar', role: 'admin', isAdmin: true };
const delivery = { name: 'Dan Singh', role: 'delivery', isAdmin: false };

const openAccountMenu = () => fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

describe('Navbar account and admin menus', () => {
  beforeEach(() => {
    authState.user = customer;
    authState.logout = vi.fn();
  });

  it('gives a customer the full account dropdown and no admin menu', () => {
    render(<Navbar />);
    expect(screen.queryByRole('button', { name: /admin control menu/i })).not.toBeInTheDocument();

    openAccountMenu();
    const menu = screen.getByRole('menu');
    ['My Profile', 'My Orders', 'My Coupons', 'Wishlist', 'Notifications', 'Logout'].forEach((label) => {
      expect(screen.getByRole('menuitem', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
    expect(menu).toBeInTheDocument();
  });

  it('keeps the cart link and hides the standalone wishlist icon for the owner', () => {
    authState.user = owner;
    render(<Navbar />);

    expect(screen.getByRole('link', { name: /^cart, 0 items$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^wishlist/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin control menu/i })).toBeInTheDocument();
  });

  it('deep-links the owner to the portals and admin sections', () => {
    authState.user = owner;
    render(<Navbar />);

    fireEvent.click(screen.getByRole('button', { name: /admin control menu/i }));
    const hrefs = screen.getAllByRole('menuitem').map((el) => el.getAttribute('href'));
    expect(hrefs).toEqual([
      '/admin',
      '/delivery',
      '/warehouse',
      '/admin?tab=users',
      '/admin?tab=orders',
      '/admin?tab=products',
      '/admin?tab=coupons',
    ]);
  });

  it('keeps the direct role link for a delivery partner and hides the admin menu', () => {
    authState.user = delivery;
    render(<Navbar />);

    expect(screen.getByRole('link', { name: /delivery dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin control menu/i })).not.toBeInTheDocument();
  });

  it('closes the open menu on Escape and on outside click', async () => {
    render(<Navbar />);

    openAccountMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    openAccountMenu();
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes the account menu when the admin menu opens', () => {
    authState.user = owner;
    render(<Navbar />);

    openAccountMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /admin control menu/i }));
    expect(screen.queryByRole('menu', { name: /account menu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: /admin control menu/i })).toBeInTheDocument();
  });

  it('logs out from the dropdown item', () => {
    render(<Navbar />);
    openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }));
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });
});
