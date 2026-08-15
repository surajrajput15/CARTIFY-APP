import { createContext, useState, useContext, useRef, useCallback, useMemo, useEffect } from 'react';
import { fetchCart, mergeCart, syncCart, clearServerCart } from '../services/cartApi';
import { useAuth } from './authContext';

const CartContext = createContext();

// Products from the API always expose `_id`; normalize a stray `id` so legacy
// localStorage carts keep working across versions.
const normalizeCart = (items) =>
  items.map((item) => ({ ...item, _id: item._id || item.id, id: undefined }));

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
    const userId = user?.id;
    if (!userId) {
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
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item._id === productId);
      let updated;
      if (existingIndex >= 0) {
        updated = prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: (item.quantity || 1) + qty } : item
        );
      } else {
        updated = [...prev, { ...product, _id: productId, quantity: qty }];
      }
      debouncedSave(updated);
      debouncedServerSync(updated);
      return updated;
    });
  }, [debouncedSave, debouncedServerSync]);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => {
      const updated = prev.filter(item => item._id !== productId);
      debouncedSave(updated);
      debouncedServerSync(updated);
      return updated;
    });
  }, [debouncedSave, debouncedServerSync]);

  const updateQuantity = useCallback((productId, action) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item._id === productId) {
          let currentQuantity = item.quantity || 1;
          if (action === 'increase') {
            currentQuantity += 1;
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

  const value = useMemo(
    () => ({ cart, addToCart, removeFromCart, updateQuantity, clearCart }),
    [cart, addToCart, removeFromCart, updateQuantity, clearCart]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);