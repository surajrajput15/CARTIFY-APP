import { createContext, useContext, useMemo } from 'react';
import { useCart } from './cartContext';
import { useCoupon } from '../hooks/useCoupon';

/**
 * F-33 — shared coupon state.
 *
 * Before this file, every screen that could show a coupon called
 * `useCoupon(cart, total)` itself, so Cart and Checkout each ran their own
 * validate/revalidate cycle and could disagree about the applied code
 * (localStorage is shared, the in-memory `applied` state was not).
 *
 * CouponProvider lives directly inside CartProvider (main.jsx), reads the cart
 * once, computes the grand total with the same formula both pages used, and
 * exposes a single `useCoupon` instance for the whole tree.
 */
const CouponContext = createContext(null);

export const CouponProvider = ({ children }) => {
  const { cart } = useCart();

  // Same math CartPage (totalAmount) and CheckoutPage (calculatedTotal) used:
  // Σ (price * quantity), tolerating missing price/quantity.
  const totalAmount = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      ),
    [cart]
  );

  const coupon = useCoupon(cart, totalAmount);

  return <CouponContext.Provider value={coupon}>{children}</CouponContext.Provider>;
};

/**
 * Shared coupon state for Cart/Checkout.
 * Throws outside the provider so a forgotten wrapper fails loudly in dev/tests
 * instead of silently rendering coupon-less UI.
 */
export const useSharedCoupon = () => {
  const ctx = useContext(CouponContext);
  if (!ctx) {
    throw new Error('useSharedCoupon must be used inside a <CouponProvider>');
  }
  return ctx;
};
