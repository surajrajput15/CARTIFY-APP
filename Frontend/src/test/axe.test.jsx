import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { getViolations, seriousViolations, formatViolations } from './axeHelper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/Modal';

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

import ProductCard from '../components/ProductCard';

const expectNoSerious = async (container) => {
  const violations = await getViolations(container);
  expect(seriousViolations(violations).map((v) => v.id)).toEqual([]);
  // Also surface moderate/Minor findings in the failure message for debugging.
  if (violations.length > 0) {
    console.warn('axe (non-serious):\n' + formatViolations(violations));
  }
};

describe('F-42 automated a11y gate (axe-core, fails on serious/critical)', () => {
  it('UI primitives form', async () => {
    const { container } = render(
      <Card>
        <label htmlFor="axe-email">Email</label>
        <Input id="axe-email" type="email" placeholder="you@example.com" />
        <Badge variant="success">In stock</Badge>
        <Button type="submit">Save changes</Button>
      </Card>
    );
    await expectNoSerious(container);
  });

  it('Modal dialog', async () => {
    const { container } = render(
      <Modal title="Confirm removal" onClose={vi.fn()}>
        <p>Remove this item from your cart?</p>
        <Button type="button">Remove</Button>
      </Modal>
    );
    await expectNoSerious(container);
  });

  it('ProductCard (primary commerce surface)', async () => {
    const { container } = render(
      <ProductCard
        product={{
          _id: 'p1',
          title: 'Classic Tee',
          price: 499,
          countInStock: 12,
          category: 'men',
          image: 'shirt.jpg',
        }}
      />
    );
    await expectNoSerious(container);
  });
});
