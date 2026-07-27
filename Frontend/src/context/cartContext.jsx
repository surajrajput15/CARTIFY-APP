import { createContext, useState, useContext, useRef } from 'react';

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

  const debouncedSave = (cartData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('cart', JSON.stringify(cartData));
    }, 300);
  };

  const addToCart = (product, qty = 1) => {
    const productId = product._id || product.id;
    const existingItemIndex = cart.findIndex(item => (item._id || item.id) === productId);

    let updatedCart;
    if (existingItemIndex >= 0) {
      updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity = (updatedCart[existingItemIndex].quantity || 1) + qty;
    } else {
      updatedCart = [...cart, { ...product, quantity: qty }];
    }

    setCart(updatedCart);
    debouncedSave(updatedCart);
  };

  const removeFromCart = (productId) => {
    const updatedCart = cart.filter(item => (item._id || item.id) !== productId);
    setCart(updatedCart);
    debouncedSave(updatedCart);
  };

  const updateQuantity = (productId, action) => {
    const updatedCart = cart.map(item => {
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

    setCart(updatedCart);
    debouncedSave(updatedCart);
  };

  const clearCart = () => {
    setCart([]);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    localStorage.removeItem('cart');
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
