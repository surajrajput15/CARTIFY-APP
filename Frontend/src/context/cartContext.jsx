import { createContext, useState, useContext, useRef, useCallback, useMemo, useEffect } from 'react';
import { fetchCart, mergeCart, syncCart, clearServerCart } from '../services/cartApi';
import { clearStoredCoupon } from '../hooks/useCoupon';
import { useAuth } from './authContext';

// F-43: split contexts — state (changes on every cart mutation) and actions
// (stable identities) live apart so memo(ProductCard) is no longer defeated by
// a fresh context value on each add/remove/quantity change. useCart() stays a
// facade over both for every other consumer.
const CartContext = createContext();
const CartActionsContext = createContext();

// Products from the API always expose `_id`; normalize a stray `id` so legacy
// localStorage carts keep working across versions. Imageless entries are dead
// references (deleted product or corrupt stored data) — drop them at load time
// so the cart can never render a "No Image" ghost (deleted-product hygiene).
const normalizeCart = (items) =>
  items
    .filter((item) => item && typeof item.image === 'string' && item.image.trim() !== '')
    .map((item) => ({ ...item, _id: item._id || item.id, id: undefined }));

const getInitialCart = () => {
  try {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) return normalizeCart(JSON.parse(savedCart));
  } catch {
    if (import.meta.env.DEV) {
      console.warn('Cart localStorage data corrupted. Clearing.');
    }
    localStorage.removeItem('cart');
  }
  return [];
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(getInitialCart);
  const saveTimeoutRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const cartRef = useRef(cart);

  // Keep a live copy of the cart for use inside effects/event handlers.
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Tracks which user id the cart has been reconciled with, plus whether the user
  // was already logged in at mount (page reload) vs. a mid-session login.
  const syncedUserRef = useRef(null);
  const loggedInAtMountRef = useRef(Boolean(user?.id));
  // Previous user id — distinguishes a real logout (signed-in → null) from a
  // guest session that was always null (F-03 / DEC-2A).
  const prevUserIdRef = useRef(user?.id ?? null);

  const persistLocal = useCallback((cartData) => {
    localStorage.setItem('cart', JSON.stringify(cartData));
  }, []);

  const debouncedSave = useCallback((cartData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistLocal(cartData);
    }, 300);
  }, [persistLocal]);

  // Push the current cart to the server (debounced) while logged in. Failures are
  // silent — localStorage remains the working copy until the next successful sync.
  const debouncedServerSync = useCallback((cartData) => {
    if (!syncedUserRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncCart(cartData).catch(() => {});
    }, 600);
  }, []);

  // Server reconciliation on auth changes:
  //  - Page reload with an existing session → server cart is authoritative, replace local.
  //  - Mid-session login (guest cart) → merge guest items into the server cart.
  useEffect(() => {
    const userId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (!userId) {
      // Logout (signed-in → null): discard the local cart + storage so the
      // next login can never merge the previous user's items (DEC-2A).
      // A pure guest session (null → null) keeps its cart.
      if (prevUserId) {
        setCart([]);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        localStorage.removeItem('cart');
        // F-04: the persisted coupon belongs to the outgoing user too — clear
        // it here even if no screen with `useCoupon` mounted (piggyback on the
        // same auth transition). Mounted instances empty-cart-clear their state.
        clearStoredCoupon();
      }
      syncedUserRef.current = null;
      loggedInAtMountRef.current = false;
      return;
    }
    if (syncedUserRef.current === userId) return;

    syncedUserRef.current = userId;
    let cancelled = false;

    (async () => {
      try {
        if (loggedInAtMountRef.current) {
          const { data } = await fetchCart();
          if (cancelled) return;
          setCart(data.items);
          persistLocal(data.items);
        } else {
          const { data } = await mergeCart(cartRef.current);
          if (cancelled) return;
          setCart(data.items);
          persistLocal(data.items);
        }
      } catch {
        // Offline or API down — keep the local cart as the working copy.
        syncedUserRef.current = null;
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, persistLocal]);

  // Clears the cart after a successful order. The server copy is cleared too so
  // the placed items don't reappear on the next device login.
  const clearCart = useCallback(async () => {
    setCart([]);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    localStorage.removeItem('cart');
    if (syncedUserRef.current) {
      clearServerCart().catch(() => {});
    }
  }, []);

  const addToCart = useCallback((product, qty = 1) => {
    const productId = product._id || product.id;
    const variantKey = product.variantKey || null;
    const lineKey = `${productId}::${variantKey || ''}`;
    setCart(prev => {
      const existingIndex = prev.findIndex(
        item => `${item._id || item.id}::${item.variantKey || ''}` === lineKey
      );
      let updated;
      if (existingIndex >= 0) {
        updated = prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: (item.quantity || 1) + qty } : item
        );
      } else {
        updated = [...prev, { ...product, _id: productId, quantity: qty, variantKey }];
      }
      debouncedSave(updated);
      debouncedServerSync(updated);
      return updated;
    });
  }, [debouncedSave, debouncedServerSync]);

  const removeFromCart = useCallback((productId, variantKey = null) => {
    setCart(prev => {
      const updated = prev.filter(
        item => !((item._id || item.id) === productId && (item.variantKey || null) === (variantKey || null))
      );
      debouncedSave(updated);
      debouncedServerSync(updated);
      return updated;
    });
  }, [debouncedSave, debouncedServerSync]);

  const updateQuantity = useCallback((productId, action, variantKey = null) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if ((item._id || item.id) === productId && (item.variantKey || null) === (variantKey || null)) {
          let currentQuantity = item.quantity || 1;
          if (action === 'increase') {
            // Never exceed tracked stock — matches the PDP cap and prevents
            // a guaranteed 409 shortfall at payment time.
            const stock = Number(item.countInStock);
            const cap = Number.isInteger(stock) && stock >= 0 ? stock : Infinity;
            currentQuantity = Math.min(currentQuantity + 1, cap);
          } else if (action === 'decrease' && currentQuantity > 1) {
            currentQuantity -= 1;
          }
          return { ...item, quantity: currentQuantity };
        }
        return item;
      });
      debouncedSave(updated);
      debouncedServerSync(updated);
      return updated;
    });
  }, [debouncedSave, debouncedServerSync]);

  const stateValue = useMemo(() => ({ cart }), [cart]);
  const actionsValue = useMemo(
    () => ({ addToCart, removeFromCart, updateQuantity, clearCart }),
    [addToCart, removeFromCart, updateQuantity, clearCart]
  );

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartContext.Provider value={stateValue}>
        {children}
      </CartContext.Provider>
    </CartActionsContext.Provider>
  );
};

/** Cart state only — subscribing to this re-renders on cart mutations. */
export const useCartState = () => useContext(CartContext);

/** Stable action callbacks — subscribing to this never re-renders on cart changes. */
export const useCartActions = () => useContext(CartActionsContext);

/** Facade over both contexts (backwards-compatible with the pre-split API). */
export const useCart = () => {
  const state = useContext(CartContext);
  const actions = useContext(CartActionsContext);
  return { ...(state || {}), ...(actions || {}) };
};