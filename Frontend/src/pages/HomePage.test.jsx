import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';

const { fetchProductsMock } = vi.hoisted(() => ({ fetchProductsMock: vi.fn() }));

vi.mock('../services/productsApi', () => ({ fetchProducts: fetchProductsMock }));
vi.mock('../components/ProductCard', () => ({
  default: ({ product }) => <div data-testid="product-card">{product.title}</div>,
}));
vi.mock('../components/HeroBanner', () => ({ default: () => null }));
vi.mock('../components/ShopByCategory', () => ({ default: () => null }));
vi.mock('../components/HomeSections', () => ({ default: () => null }));
vi.mock('../components/Skeleton', () => ({ SkeletonList: () => <div>skeleton</div> }));

import HomePage from './HomePage';

const PAGE = { products: [{ _id: 'p1', title: 'Shoe' }], total: 1, pages: 3 };

// Drives a URL change the way the Navbar/ShopByCategory chips do.
const Nav = ({ to }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>navigate</button>;
};
const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="loc">{location.pathname + location.search}</span>;
};

const renderHome = (entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Nav to="/?category=shoes" />
      <LocationProbe />
      <HomePage />
    </MemoryRouter>
  );

describe('HomePage URL-driven results (F-12 + F-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProductsMock.mockResolvedValue({ data: PAGE });
    // jsdom does not implement scrollIntoView (used by goToPage).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('fetches exactly once for a deep-linked category + page', async () => {
    renderHome('/?category=shoes&page=2');

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1));
    expect(fetchProductsMock).toHaveBeenCalledWith({ page: 2, limit: 12, category: 'shoes' });
    // Settled: no second (sync-effect) fetch arrives late.
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchProductsMock).toHaveBeenCalledTimes(1);
  });

  it('issues exactly one fetch when a filter changes (no sync-effect cascade)', async () => {
    renderHome('/');

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(2));
    expect(fetchProductsMock).toHaveBeenLastCalledWith({ page: 1, limit: 12, category: 'shoes' });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchProductsMock).toHaveBeenCalledTimes(2);
  });

  it('puts ?page= in the URL when paging and keeps filters', async () => {
    renderHome('/?category=shoes');

    const pageTwo = await screen.findByRole('button', { name: 'Page 2' });
    fireEvent.click(pageTwo);

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(2));
    expect(fetchProductsMock).toHaveBeenLastCalledWith({ page: 2, limit: 12, category: 'shoes' });
    expect(screen.getByTestId('loc')).toHaveTextContent('/?category=shoes&page=2');
  });

  it('drops ?page= again when returning to page 1', async () => {
    renderHome('/?category=shoes&page=3');

    const pageOne = await screen.findByRole('button', { name: 'Page 1' });
    fireEvent.click(pageOne);

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(2));
    expect(fetchProductsMock).toHaveBeenLastCalledWith({ page: 1, limit: 12, category: 'shoes' });
    expect(screen.getByTestId('loc')).toHaveTextContent('/?category=shoes');
  });

  it('passes sort + price range from the URL straight to the API (F-17)', async () => {
    renderHome('/?sort=price_asc&min=100&max=600');

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1));
    expect(fetchProductsMock).toHaveBeenCalledWith({
      page: 1,
      limit: 12,
      sort: 'price_asc',
      minPrice: '100',
      maxPrice: '600',
    });
  });

  it('updates ?sort= when the sort control changes and resets to page 1', async () => {
    renderHome('/?category=shoes&page=2');

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Sort products'), { target: { value: 'price_desc' } });

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(2));
    expect(fetchProductsMock).toHaveBeenLastCalledWith({
      page: 1,
      limit: 12,
      category: 'shoes',
      sort: 'price_desc',
    });
    expect(screen.getByTestId('loc')).toHaveTextContent('/?category=shoes&sort=price_desc');
    expect(screen.getByLabelText('Sort products')).toHaveValue('price_desc');
  });

  it('commits the price inputs to the URL only when Apply is clicked', async () => {
    renderHome('/');

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '900' } });
    // Typing alone must not refetch.
    expect(fetchProductsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(fetchProductsMock).toHaveBeenCalledTimes(2));
    expect(fetchProductsMock).toHaveBeenLastCalledWith({
      page: 1,
      limit: 12,
      minPrice: '250',
      maxPrice: '900',
    });
    expect(screen.getByTestId('loc')).toHaveTextContent('/?min=250&max=900');
  });
});
