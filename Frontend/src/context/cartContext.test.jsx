import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartProvider, useCart, useCartState, useCartActions } from './cartContext';

// CartProvider only reads auth state — no AuthProvider needed in this test.
vi.mock('./authContext', () => ({ useAuth: () => ({ user: null }) }));

// Render counters live behind vi.fn() so the react-hooks/globals rule (no
// mutating module-scope variables from a component) stays happy.
const onStateRender = vi.fn();
const onActionsRender = vi.fn();

const StateProbe = () => {
  const { cart } = useCartState();
  onStateRender();
  return <span data-testid="count">{cart.length}</span>;
};

const ActionsProbe = () => {
  useCartActions();
  onActionsRender();
  return null;
};

const Driver = () => {
  // The pre-split facade must keep working unchanged.
  const { addToCart, removeFromCart, updateQuantity, clearCart, cart } = useCart();
  return (
    <>
      <span data-testid="facade-count">{Array.isArray(cart) ? cart.length : 'missing'}</span>
      <button
        type="button"
        onClick={() => addToCart({ _id: 'p1', title: 'Widget', price: 10 })}
      >
        add
      </button>
      <button type="button" onClick={() => removeFromCart('p1')}>
        remove
      </button>
      <button type="button" onClick={() => updateQuantity('p1', 'increase')}>
        inc
      </button>
      <button type="button" onClick={() => clearCart()}>
        clear
      </button>
    </>
  );
};

describe('F-43 cart context split', () => {
  beforeEach(() => {
    localStorage.clear();
    onStateRender.mockClear();
    onActionsRender.mockClear();
  });

  it('action subscribers do NOT re-render on cart mutations; state + facade do', () => {
    render(
      <CartProvider>
        <StateProbe />
        <ActionsProbe />
        <Driver />
      </CartProvider>
    );

    expect(screen.getByTestId('facade-count').textContent).toBe('0');

    const actionsBefore = onActionsRender.mock.calls.length;
    const stateBefore = onStateRender.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    // State + facade reflect the mutation…
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('facade-count').textContent).toBe('1');
    expect(onStateRender.mock.calls.length).toBeGreaterThan(stateBefore);

    // …but the actions-only subscriber stayed at its mount count: this is the
    // mechanism that lets memo(ProductCard) survive cart changes (F-43).
    expect(onActionsRender.mock.calls.length).toBe(actionsBefore);
  });

  it('facade exposes every action and further mutations never bump the actions subscriber', () => {
    render(
      <CartProvider>
        <StateProbe />
        <ActionsProbe />
        <Driver />
      </CartProvider>
    );

    const actionsBefore = onActionsRender.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    fireEvent.click(screen.getByRole('button', { name: 'inc' }));
    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(onActionsRender.mock.calls.length).toBe(actionsBefore);
  });
});
