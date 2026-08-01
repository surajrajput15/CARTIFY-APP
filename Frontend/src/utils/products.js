export const EMPTY_PRODUCT_FORM = {
  title: '',
  price: '',
  description: '',
  category: 'electronics',
  image: '',
  rating: { rate: 0, count: 0 }
};

export const filterProducts = (products, { searchTerm = '', filterCategory = '' } = {}) => {
  let result = products;
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    result = result.filter(p =>
      p.title.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term))
    );
  }
  if (filterCategory) {
    result = result.filter(p => p.category === filterCategory);
  }
  return result;
};

export const getProductCategories = (products) => [...new Set(products.map(p => p.category))].sort();
