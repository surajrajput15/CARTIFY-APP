import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchBox from './SearchBox';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/productsApi', () => ({
  fetchProducts: vi.fn().mockResolvedValue({
    data: {
      products: [
        { _id: 'p1', title: 'Wireless Headphones' },
        { _id: 'p2', title: 'Mechanical Keyboard' },
      ],
    },
  }),
}));

vi.mock('../utils/recentSearches', () => ({
  getRecentSearches: () => ['shoes', 'laptop'],
  clearRecentSearches: vi.fn(),
  recordSearch: vi.fn(),
}));

describe('SearchBox component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with accessibility attributes', () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/search for products/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('submits search on Enter and calls onSearch or navigates', () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/search for products/i);

    fireEvent.change(input, { target: { value: 'jacket' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onSearch).toHaveBeenCalledWith('jacket');
  });

  it('shows category and recent search suggestions on focus when empty', () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/search for products/i);

    fireEvent.focus(input);

    expect(screen.getByText('shoes')).toBeInTheDocument();
    expect(screen.getByText('laptop')).toBeInTheDocument();
  });

  it('fetches and displays suggestions after debounced typing', async () => {
    render(<SearchBox />);
    const input = screen.getByPlaceholderText(/search for products/i);

    fireEvent.change(input, { target: { value: 'head' } });

    await waitFor(
      () => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
