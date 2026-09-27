import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { validateCoupon, findBestCoupon } from '../services/couponsApi';

const STORAGE_KEY = 'cartify_coupon_code';

/**
 * Drops the persisted coupon code without touching any component state.
 * Called by CartProvider on the logout transition (F-04) so the key is cleared
 * even when no screen with a mounted `useCoupon` instance is open.
 */
export const clearStoredCoupon = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
};

// Cart items are only ever consumed as an array, and every caller (CartPage,
// CheckoutPage, the available-coupons modal) is a potential source of undefined
// or a stale non-array value. Normalising here keeps a bad prop from throwing
// `undefined.map` during render, which is unrecoverable for the whole subtree.
const normalizeCart = (value) => (Array.isArray(value) ? value : []);
const normalizeTotal = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const toItemsPayload = (cart) =>
  cart.map((i) => ({ productId: i._id || i.id, quantity: i.quantity, category: i.category }));

export const useCoupon = (cart, totalAmount) => {
  const [code, setCode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [applied, setApplied] = useState(null); // { code, discount, finalAmount }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bestLoading, setBestLoading] = useState(false);
  const debounceRef = useRef(null);

  // Stable identities: the memo only recomputes when the caller actually
  // passes a different array (or nothing at all), so the effects below don't
  // re-fire every render.
  const safeCart = useMemo(() => normalizeCart(cart), [cart]);
  const safeTotal = useMemo(() => normalizeTotal(totalAmount), [totalAmount]);

  // Identity key of the cart contents. Two carts with the same total but
  // different items (e.g. swapped products at equal price) get different keys,
  // so category/min-quantity coupons are re-validated on any content change.
  const cartKey = useMemo(
    () => safeCart.map((i) => `${i._id}:${i.quantity}:${i.price}:${i.category}`).join('|'),
    [safeCart]
  );

  const clearCoupon = useCallback(() => {
    setApplied(null);
    setError('');
    setCode('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }, []);

  const doValidate = useCallback(async (c, amount, items) => {
    const raw = typeof c === 'string' ? c : String(c ?? '');
    if (!raw.trim()) {
      setError('Enter a coupon code');
      return;
    }
    const normalized = raw.trim().toUpperCase();
    setLoading(true);
    setError('');
    try {
      const { data } = await validateCoupon(normalized, amount, toItemsPayload(items));
      if (!data?.coupon) {
        setError('Invalid or expired coupon');
        setApplied(null);
        return;
      }
      // Keep the visible input in sync with what is actually applied, so
      // applying from the coupon list and applying from the form agree.
      setCode(normalized);
      setApplied(data.coupon);
      try { localStorage.setItem(STORAGE_KEY, normalized); } catch { /* storage unavailable */ }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid or expired coupon';
      setError(msg);
      // Preserve the currently valid coupon: only clear it if the failed
      // attempt targeted the applied code itself or nothing is applied yet.
      setApplied((prev) => (prev && prev.code !== normalized ? prev : null));
    } finally {
      setLoading(false);
    }
  }, []);

  // `explicitCode` is supplied by the available-coupons modal (apply this exact
  // code) and omitted by the form button (apply whatever is typed).
  const applyCoupon = useCallback((explicitCode) => {
    // debounced entry point for button
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doValidate(explicitCode != null ? explicitCode : code, safeTotal, safeCart);
  }, [code, safeTotal, safeCart, doValidate]);

  const applyBestCoupon = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBestLoading(true);
    setError('');
    try {
      const { data } = await findBestCoupon(safeTotal, toItemsPayload(safeCart));
      if (data?.found && data.coupon) {
        setApplied(data.coupon);
        setCode(data.coupon.code);
        try { localStorage.setItem(STORAGE_KEY, data.coupon.code); } catch { /* storage unavailable */ }
      } else {
        setApplied(null);
        setCode('');
        setError('No coupons apply to this cart right now');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not find a best coupon';
      setError(msg);
    } finally {
      setBestLoading(false);
    }
  }, [safeCart, safeTotal, setCode]);

  // Auto-revalidate when the cart total OR contents change after a coupon is
  // applied. Content changes at equal total (item swaps) also re-validate.
  useEffect(() => {
    if (!applied) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doValidate(applied.code, safeTotal, safeCart);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [safeTotal, cartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear any applied coupon when the cart empties (logout, order placed) so a
  // stale discount never follows the next user or the next cart. One-shot
  // guard against a cross-session leak — intentional effect.
  useEffect(() => {
    if (safeCart.length === 0 && applied) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cross-user leak guard
      clearCoupon();
    }
  }, [safeCart.length, applied, clearCoupon]);

  // Re-validate on mount if a code was persisted in localStorage. State is
  // only touched in async callbacks below so this doesn't trigger the
  // set-state-in-effect rule (there is no synchronous setState in the body).
  useEffect(() => {
    if (!code || safeTotal <= 0 || safeCart.length === 0 || applied) return;
    let cancelled = false;
    validateCoupon(code.trim().toUpperCase(), safeTotal, toItemsPayload(safeCart))
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.coupon) {
          setError('Invalid or expired coupon');
          setApplied(null);
          return;
        }
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

  return { code, setCode, applied, loading, error, applyCoupon, applyBestCoupon, bestLoading, clearCoupon, setError };
};
