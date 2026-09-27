export const EMPTY_PRODUCT_FORM = {
  title: '',
  price: '',
  description: '',
  category: 'electronics',
  image: '',
  countInStock: 20,
  rating: { rate: 0, count: 0 },
  variants: []
};

export const EMPTY_VARIANT = { size: '', color: '', sku: '', stock: 0, priceAdjustment: 0 };

export const filterProducts = (products, { searchTerm = '', filterCategory = '' } = {}) => {
  let result = products;
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    // F-48: coerce — a product missing title/category must not blank the page.
    result = result.filter(p =>
      String(p.title ?? '').toLowerCase().includes(term) ||
      String(p.category ?? '').toLowerCase().includes(term) ||
      (p.brand && String(p.brand).toLowerCase().includes(term))
    );
  }
  if (filterCategory) {
    result = result.filter(p => p.category === filterCategory);
  }
  return result;
};

export const getProductCategories = (products) => [...new Set(products.map(p => p.category))].sort();
