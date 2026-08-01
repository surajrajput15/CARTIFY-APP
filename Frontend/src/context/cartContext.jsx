import { createContext, useState, useContext, useRef, useCallback, useMemo } from 'react';

const CartContext = createContext();

const getInitialCart = () => {
  try {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) return JSON.parse(savedCart);
  } catch {
    if (import.meta.env.DEV) {
      console.warn('Cart localStorage data corrupted. Clearing.');
    }
    localStorage.removeItem('cart');
  }
  return [];
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(getInitialCart);
  const saveTimeoutRef = useRef(null);

  const debouncedSave = useCallback((cartData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('cart', JSON.stringify(cartData));
    }, 300);
  }, []);

  const addToCart = useCallback((product, qty = 1) => {
    const productId = product._id || product.id;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => (item._id || item.id) === productId);
      if (existingIndex >= 0) {
        const updated = prev.map((item, i) =>
          i === existingIndex ? { ...item, quantity: (item.quantity || 1) + qty } : item
        );
        debouncedSave(updated);
        return updated;
      }
      const updated = [...prev, { ...product, quantity: qty }];
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => {
      const updated = prev.filter(item => (item._id || item.id) !== productId);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateQuantity = useCallback((productId, action) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if ((item._id || item.id) === productId) {
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
      return updated;
    });
  }, [debouncedSave]);

  const clearCart = useCallback(() => {
    setCart([]);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    localStorage.removeItem('cart');
  }, []);

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
