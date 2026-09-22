// Shared variant helpers (clothing variants). Mirrors backend utils/variants.js.
// The canonical wire key is "size|color" (either side may be empty).

export const buildVariantKey = (variant) => {
  if (!variant) return null;
  return `${variant.size || ''}|${variant.color || ''}`;
};

export const parseVariantKey = (key) => {
  if (typeof key !== 'string') return { size: null, color: null };
  const [size = '', color = ''] = key.split('|');
  return { size: size.trim() || null, color: color.trim() || null };
};

export const hasVariants = (product) =>
  Array.isArray(product?.variants) && product.variants.length > 0;

export const variantsTotalStock = (product) => {
  if (!hasVariants(product)) return null;
  return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
};

// Effective sellable stock: sum of variant stock when variants exist, else the
// flat countInStock (legacy behaviour preserved).
export const effectiveStock = (product) => {
  const total = variantsTotalStock(product);
  if (total !== null) return total;
  const flat = Number(product?.countInStock);
  return Number.isFinite(flat) ? flat : 0;
};

// Unique size/color options in first-seen order.
export const getVariantOptions = (product) => {
  const sizes = [];
  const colors = [];
  (product?.variants || []).forEach((v) => {
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    if (v.color && !colors.includes(v.color)) colors.push(v.color);
  });
  return { sizes, colors };
};

// Exact variant match by size + color (either may be null/undefined).
export const findVariant = (product, size, color) =>
  (product?.variants || []).find(
    (v) => (v.size || null) === (size || null) && (v.color || null) === (color || null)
  ) || null;

export const variantPrice = (product, variant) =>
  (Number(product?.price) || 0) + (Number(variant?.priceAdjustment) || 0);

export const variantLabel = (size, color) => {
  const parts = [size, color].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Default';
};

// A size/color choice is available if a matching variant has stock, treating an
// unselected axis as a wildcard (so sizes light up before a colour is chosen).
export const isOptionAvailable = (product, { size = null, color = null } = {}) =>
  (product?.variants || []).some(
    (v) =>
      (Number(v.stock) || 0) > 0 &&
      (size == null || (v.size || null) === size) &&
      (color == null || (v.color || null) === color)
  );
