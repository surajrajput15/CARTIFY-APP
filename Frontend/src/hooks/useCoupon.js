import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { validateCoupon } from '../services/couponsApi';

const STORAGE_KEY = 'cartify_coupon_code';

export const useCoupon = (cart, totalAmount) => {
  const [code, setCode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [applied, setApplied] = useState(null); // { code, discount, finalAmount }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Identity key of the cart contents. Two carts with the same total but
  // different items (e.g. swapped products at equal price) get different keys,
  // so category/min-quantity coupons are re-validated on any content change.
  const cartKey = useMemo(
    () => cart.map((i) => `${i._id}:${i.quantity}:${i.price}:${i.category}`).join('|'),
    [cart]
  );

  const clearCoupon = useCallback(() => {
    setApplied(null);
    setError('');
    setCode('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }, []);

  const doValidate = useCallback(async (c, amount, items) => {
    if (!c.trim()) {
      setError('Enter a coupon code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const itemsPayload = items.map(i => ({ productId: i._id || i.id, quantity: i.quantity, category: i.category }));
      const { data } = await validateCoupon(c.trim().toUpperCase(), amount, itemsPayload);
      setApplied(data.coupon);
      try { localStorage.setItem(STORAGE_KEY, c.trim().toUpperCase()); } catch { /* storage unavailable */ }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid or expired coupon';
      setError(msg);
      // Preserve the currently valid coupon: only clear it if the failed
      // attempt targeted the applied code itself or nothing is applied yet.
      const failedCode = c.trim().toUpperCase();
      setApplied((prev) => (prev && prev.code !== failedCode ? prev : null));
    } finally {
      setLoading(false);
    }
  }, []);

  const applyCoupon = useCallback(() => {
    // debounced entry point for button
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doValidate(code, totalAmount, cart);
  }, [code, totalAmount, cart, doValidate]);

  // Auto-revalidate when the cart total OR contents change after a coupon is
  // applied. Content changes at equal total (item swaps) also re-validate.
  useEffect(() => {
    if (!applied) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doValidate(applied.code, totalAmount, cart);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [totalAmount, cartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear any applied coupon when the cart empties (logout, order placed) so a
  // stale discount never follows the next user or the next cart. One-shot
  // guard against a cross-session leak — intentional effect.
  useEffect(() => {
    if (cart.length === 0 && applied) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cross-user leak guard
      clearCoupon();
    }
  }, [cart.length, applied, clearCoupon]);

  // Re-validate on mount if a code was persisted in localStorage. State is
  // only touched in async callbacks below so this doesn't trigger the
  // set-state-in-effect rule (there is no synchronous setState in the body).
  useEffect(() => {
    if (!code || totalAmount <= 0 || cart.length === 0 || applied) return;
    let cancelled = false;
    const itemsPayload = cart.map((i) => ({ productId: i._id || i.id, quantity: i.quantity, category: i.category }));
    validateCoupon(code.trim().toUpperCase(), totalAmount, itemsPayload)
      .then(({ data }) => {
        if (cancelled) return;
        setApplied(data.coupon);
        try { localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase()); } catch { /* storage unavailable */ }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Invalid or expired coupon');
        setApplied(null);
      });
    return () => { cancelled = true; };
    // only on mount; guarded by the early return above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { code, setCode, applied, loading, error, applyCoupon, clearCoupon, setError };
};
