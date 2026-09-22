import api from '../api/axios';

// GET /api/wishlist — current user ki wishlist fetch kare
export const fetchWishlist = () => api.get('/api/wishlist');

// POST /api/wishlist/add — wishlist mein product add kare
export const addToWishlist = (productId) =>
  api.post('/api/wishlist/add', { productId });

// POST /api/wishlist/remove — wishlist se product remove kare
export const removeFromWishlist = (productId) =>
  api.post('/api/wishlist/remove', { productId });
