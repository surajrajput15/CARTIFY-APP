import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetailsPage from './ProductDetailsPage';
import { fetchProductById, fetchProducts } from '../services/productsApi';
import { fetchProductReviews } from '../services/reviewApi';

const mocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../context/cartContext', () => ({
  useCart: () => ({ addToCart: mocks.addToCart }),
}));

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({
    isWishlisted: () => false,
    addToWishlist: vi.fn().mockResolvedValue(true),
    removeFromWishlist: vi.fn().mockResolvedValue(true),
    wishlist: [],
  }),
}));

vi.mock('../context/authContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Tester' } }),
}));

vi.mock('../services/productsApi', () => ({
  fetchProductById: vi.fn(),
  fetchProducts: vi.fn(),
}));

vi.mock('../services/reviewApi', () => ({
  fetchProductReviews: vi.fn().mockResolvedValue({ data: { reviews: [] } }),
  createReview: vi.fn(),
}));

vi.mock('../hooks/useSeo', () => ({
  default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleProduct = {
  _id: 'p-101',
  title: 'Urban Explorer Jacket',
  description: 'Premium weather-resistant utility jacket for city and trail.',
  category: 'clothing',
  price: 2499,
  countInStock: 8,
  image: 'jacket.jpg',
  rating: { rate: 4.8, count: 120 },
};

describe('ProductDetailsPage Mobile Sticky Purchase Bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProductById.mockResolvedValue({ data: sampleProduct });
    fetchProducts.mockResolvedValue({ data: { products: [] } });
    fetchProductReviews.mockResolvedValue({ data: { reviews: [] } });
  });

  const renderPage = (productId = 'p-101') => {
    return render(
      <MemoryRouter initialEntries={[`/product/${productId}`]}>
        <Routes>
          <Route path="/product/:id" element={<ProductDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders product details and main Add to Cart button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Urban Explorer Jacket' })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/₹2,499/i).length).toBeGreaterThan(0);
    const addToCartBtn = screen.getByRole('button', { name: /add to cart/i });
    expect(addToCartBtn).toBeInTheDocument();

    fireEvent.click(addToCartBtn);
    expect(mocks.addToCart).toHaveBeenCalledWith(sampleProduct, 1);
  });

  it('renders mobile sticky purchase bar when main CTA scrolls out of view', async () => {
    let observerCallback;
    class MockObserver {
      constructor(cb) {
        observerCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const origObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockObserver;

    try {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Urban Explorer Jacket' })).toBeInTheDocument();
      });

      // Initially main CTA is visible, sticky bar region should not be visible
      expect(screen.queryByRole('region', { name: /quick purchase bar/i })).not.toBeInTheDocument();

      // Simulate main CTA scrolling out of viewport (isIntersecting: false)
      act(() => {
        observerCallback([{ isIntersecting: false }]);
      });

      // Quick purchase bar should now appear
      const stickyBar = screen.getByRole('region', { name: /quick purchase bar/i });
      expect(stickyBar).toBeInTheDocument();

      // Sticky bar should display the product title and Add to Cart button
      expect(stickyBar).toHaveTextContent('Urban Explorer Jacket');
      expect(stickyBar).toHaveTextContent(/₹2,499/i);

      // Clicking Add to Cart from the sticky bar invokes the existing addToCart handler
      const stickyCta = stickyBar.querySelector('button');
      fireEvent.click(stickyCta);
      expect(mocks.addToCart).toHaveBeenCalledWith(sampleProduct, 1);
    } finally {
      globalThis.IntersectionObserver = origObserver;
    }
  });

  it('disables add to cart when product is out of stock', async () => {
    fetchProductById.mockResolvedValue({
      data: { ...sampleProduct, countInStock: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Urban Explorer Jacket' })).toBeInTheDocument();
    });

    const outOfStockBtn = screen.getByRole('button', { name: /out of stock/i });
    expect(outOfStockBtn).toBeDisabled();
  });
});
