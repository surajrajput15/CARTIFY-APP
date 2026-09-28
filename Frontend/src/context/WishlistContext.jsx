import { createContext, useState, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '../services/wishlistApi';
import { useAuth } from './authContext';
import toast from 'react-hot-toast';
import { logError } from '../utils/logger';

const WishlistContext = createContext();

// Normalize a product id for consistent lookups.
const getProductId = (product) => product._id || product.id || product.productId;

// Null-safe id extraction used in callbacks that may receive a raw id string
// or a product object.
const extractId = (productOrId) => {
  if (productOrId == null) return null;
  if (typeof productOrId === 'string') return productOrId;
  return productOrId._id || productOrId.id || productOrId.productId || null;
};

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  // True only when a signed-in fetch failed — lets the page show "couldn't
  // load" instead of misleading the user with an empty wishlist.
  const [wishlistError, setWishlistError] = useState(false);
  const wishlistRef = useRef(wishlist);

  useEffect(() => {
    wishlistRef.current = wishlist;
  }, [wishlist]);

  const syncedUserRef = useRef(null);

  const saveToLocal = useCallback((items) => {
    try {
      localStorage.setItem('wishlist', JSON.stringify(items.map((p) => getProductId(p))));
    } catch {
      // ignore storage errors
    }
  }, []);

  const loadFromLocal = useCallback(() => {
    try {
      const stored = localStorage.getItem('wishlist');
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) return ids;
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn('Wishlist localStorage data corrupted. Clearing.');
      }
      localStorage.removeItem('wishlist');
    }
    return [];
  }, []);

  const fetchWishlistFromServer = useCallback(async () => {
    // Wishlist is server-only: guests have no session, so a fetch would just
    // 401 (POST /wishlist/add noise). Bail out without hitting the API.
    if (!user?.id) {
      setWishlistLoading(false);
      setWishlistError(false);
      return wishlistRef.current;
    }
    try {
      const { data } = await fetchWishlist();
      const items = Array.isArray(data.products) ? data.products : [];
      setWishlist(items);
      saveToLocal(items);
      setWishlistLoading(false);
      setWishlistError(false);
      return items;
    } catch {
      setWishlistLoading(false);
      setWishlistError(true);
      return wishlistRef.current;
    }
  }, [saveToLocal, user?.id]);

  // Server reconciliation on auth changes. setState only happens inside the
  // async callback below (never synchronously in the effect body), so this
  // does not trip react-hooks/set-state-in-effect — same pattern as
  // cartContext.jsx.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      syncedUserRef.current = null;
      loadFromLocal(); // validate local copy; drops corrupted data
      let cancelled = false;
      // Defer the reset to an async tick so logout clears the wishlist
      // without a synchronous setState-in-effect.
      (async () => {
        await Promise.resolve();
        if (cancelled) return;
        setWishlist([]);
        saveToLocal([]);
        setWishlistLoading(false);
        setWishlistError(false);
      })();
      return () => { cancelled = true; };
    }

    if (syncedUserRef.current === userId) return;
    syncedUserRef.current = userId;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await fetchWishlist();
        const serverProducts = Array.isArray(data.products) ? data.products : [];

        if (cancelled) return;
        setWishlist(serverProducts);
        saveToLocal(serverProducts);
        setWishlistLoading(false);
        setWishlistError(false);
      } catch {
        if (cancelled) return;
        setWishlist([]);
        setWishlistLoading(false);
        setWishlistError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, loadFromLocal, saveToLocal]);

  const isWishlistedCheck = useCallback((productId) => {
    const productIdStr = extractId(productId);
    if (!productIdStr) return false;
    return wishlist.some((p) => String(getProductId(p)) === String(productIdStr));
  }, [wishlist]);

  const addToWishlistHandler = useCallback(async (product) => {
    const productId = extractId(product);
    if (!productId) return false;
    if (isWishlistedCheck(productId)) return true;
    // The API requires a session — a guest call only produces a 401. Prompt
    // for login instead of firing an unauthorized request.
    if (!user?.id) {
      toast.error('Please log in to save items to your wishlist');
      return false;
    }
    try {
      await addToWishlist(productId);
      setWishlist((prev) => {
        if (prev.find((p) => String(getProductId(p)) === String(productId))) {
          return prev;
        }
        return [...prev, { productId, ...(typeof product === 'object' ? product : {}) }];
      });
      return true;
    } catch (err) {
      logError('Add to wishlist failed:', err);
      toast.error('Could not save to wishlist. Please try again.');
      return false;
    }
  }, [isWishlistedCheck, user?.id]);

  const removeFromWishlistHandler = useCallback(async (product) => {
    const productId = extractId(product);
    if (!productId) return false;
    if (!isWishlistedCheck(productId)) return true;
    if (!user?.id) {
      toast.error('Please log in to manage your wishlist');
      return false;
    }
    try {
      await removeFromWishlist(productId);
      setWishlist((prev) => prev.filter((p) => String(getProductId(p)) !== String(productId)));
      return true;
    } catch (err) {
      logError('Remove from wishlist failed:', err);
      toast.error('Could not update wishlist. Please try again.');
      return false;
    }
  }, [isWishlistedCheck, user?.id]);

  const value = useMemo(
    () => ({
      wishlist,
      wishlistLoading,
      wishlistError,
      isWishlisted: isWishlistedCheck,
      addToWishlist: addToWishlistHandler,
      removeFromWishlist: removeFromWishlistHandler,
      refreshWishlist: fetchWishlistFromServer,
    }),
    [wishlist, wishlistLoading, wishlistError, isWishlistedCheck, addToWishlistHandler, removeFromWishlistHandler, fetchWishlistFromServer]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
