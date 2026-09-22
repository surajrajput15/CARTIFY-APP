const RECENT_KEY_BASE = 'cartify_recent';
const MAX_RECENT = 8;

const snapshotFromProduct = (product) => {
  if (!product || typeof product !== 'object') return null;
  const id = product._id || product.id;
  if (!id) return null;
  return {
    _id: id,
    title: product.title,
    image: product.image,
    price: product.price,
    category: product.category,
    countInStock: product.countInStock,
    brand: product.brand,
    viewedAt: Date.now(),
  };
};

export const getRecentKey = (userId) => {
  const base = userId ? `${userId}` : 'guest';
  return `${RECENT_KEY_BASE}_${base}`;
};

export const getRecentViewed = (userId) => {
  try {
    const key = getRecentKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && p._id)
      .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

export const recordRecentView = (product, userId) => {
  if (!product) return;
  const snapshot = snapshotFromProduct(product);
  if (!snapshot) return;
  try {
    const key = getRecentKey(userId);
    const existing = getRecentViewed(userId);
    const next = [snapshot, ...existing.filter((p) => String(p._id) !== String(snapshot._id))]
      .slice(0, MAX_RECENT);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage unavailable — silently skip (feature is best-effort).
  }
};

export const clearRecentViewed = (userId) => {
  try {
    localStorage.removeItem(getRecentKey(userId));
  } catch {
    // ignore
  }
};