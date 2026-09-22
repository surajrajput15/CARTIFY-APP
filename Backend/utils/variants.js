// Shared variant helpers (V2 clothing variants).
// A variant row on Product looks like:
//   { size: 'M' | null, color: 'Black' | null, stock: Number, priceAdjustment: Number, sku: String|null }
// The canonical wire key is "size|color" (either side may be empty), e.g.
//   "M|Black", "|Navy Blue", "L|" — clients send this as `variantKey`.

const buildVariantKey = (variant) => {
  if (!variant) return null;
  return `${variant.size || ''}|${variant.color || ''}`;
};

// Sum of variant stock — the effective sellable stock for a variant product.
const variantsTotalStock = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) return null;
  return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
};

const parseVariantKey = (key) => {
  if (typeof key !== 'string') return null;
  const [size = '', color = ''] = key.split('|');
  return { size: size.trim() || null, color: color.trim() || null };
};

module.exports = { buildVariantKey, variantsTotalStock, parseVariantKey };