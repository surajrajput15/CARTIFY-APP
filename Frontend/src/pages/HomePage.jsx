import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';

const getPageNumbers = (current, total) => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, '...', total];
  }

  if (current >= total - 2) {
    return [1, '...', total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
};

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 12 };
    if (selectedCategory !== 'all') params.category = selectedCategory;
    if (searchQuery) params.search = searchQuery;

      api.get('/api/products', { params })
      .then((response) => {
        const d = response.data;
        if (Array.isArray(d)) {
          setProducts(d);
          setTotal(d.length);
          setPages(1);
        } else {
          setProducts(d.products);
          setTotal(d.total);
          setPages(d.pages);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch products:", error);
        toast.error("Failed to load products");
      })
      .finally(() => setLoading(false));
  }, [page, selectedCategory, searchQuery]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <HeroBanner />

      <div className="mt-12 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-center">
        <div className="flex flex-wrap gap-3 justify-center">
          {['all', 'electronics', 'clothing', 'footwear', 'accessories', 'furniture', 'beauty'].map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              aria-pressed={selectedCategory === cat}
              className={`px-5 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div id="products" className="mb-6 flex justify-between items-end scroll-mt-24">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Trending Products ⚡'}
          </h2>
          <div className="w-20 h-1 bg-teal-500 rounded mt-2"></div>
        </div>
        {!loading && <span className="text-sm text-gray-500">{total} products found</span>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-56 bg-gray-200"></div>
              <div className="p-5 space-y-3">
                <div className="h-3 w-16 bg-gray-200 rounded-full"></div>
                <div className="h-4 w-full bg-gray-200 rounded"></div>
                <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-12 bg-gray-200 rounded"></div>
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                  <div className="h-10 w-10 bg-gray-200 rounded-xl"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="First page"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                Prev
              </button>

              {getPageNumbers(page, pages).map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 font-bold" aria-hidden="true">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    aria-label={`Page ${item}`}
                    aria-current={page === item ? 'page' : undefined}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                      page === item ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
              </button>
              <button
                onClick={() => setPage(pages)}
                disabled={page === pages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Last page"
              >
                Last
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-400 mb-2">Sorry, no results found! 🕵️‍♂️</h3>
          <p className="text-gray-500">
            We couldn't find any matches for <span className="font-semibold text-gray-700">"{searchQuery}"</span>.
          </p>
          <p className="text-gray-500 mt-1">Try checking your spelling or using more general terms.</p>
        </div>
      )}
    </main>
  );
};

export default HomePage;
