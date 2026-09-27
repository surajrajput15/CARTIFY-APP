import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../context/cartContext', () => ({
  useCart: () => ({ addToCart: mocks.addToCart }),
  useCartActions: () => ({ addToCart: mocks.addToCart }),
}));
vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({ isWishlisted: () => false, addToWishlist: vi.fn(), removeFromWishlist: vi.fn(), wishlist: [] }),
}));
vi.mock('../hooks/useActiveCampaigns', () => ({ useActiveCampaigns: () => ({ bestForProduct: () => null }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => mocks.navigate,
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import toast from 'react-hot-toast';
import ProductCard from './ProductCard';

const product = {
  _id: 'p1',
  title: 'Classic Tee',
  price: 499,
  countInStock: 12,
  category: 'men',
  image: 'shirt.jpg',
};

describe('ProductCard add-to-cart feedback (F-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds to cart with a toast and an aria-live confirmation', () => {
    render(<ProductCard product={product} />);

    fireEvent.click(screen.getByRole('button', { name: /add classic tee to cart/i }));

    expect(mocks.addToCart).toHaveBeenCalledWith(product);
    expect(toast.success).toHaveBeenCalledWith('Added to cart');
    expect(screen.getByRole('status')).toHaveTextContent('Classic Tee added to cart');
    // Button itself confirms: icon flips + label reports the added state.
    expect(screen.getByRole('button', { name: /classic tee added to cart/i })).toBeInTheDocument();
  });

  it('starts with no confirmation before the first click', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('routes variant products to the detail page without adding', () => {
    const variantProduct = { ...product, variants: [{ size: 'M', color: 'Red', price: 499, stock: 5 }] };
    render(<ProductCard product={variantProduct} />);

    fireEvent.click(screen.getByRole('button', { name: /choose options for classic tee/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/product/p1');
    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('gives no feedback when the product is out of stock', () => {
    render(<ProductCard product={{ ...product, countInStock: 0 }} />);

    const button = screen.getByRole('button', { name: /out of stock/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
