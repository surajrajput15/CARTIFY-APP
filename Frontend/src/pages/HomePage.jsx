import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchProducts } from '../services/productsApi';
import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';
import { SkeletonList } from '../components/Skeleton';
import { SearchEmptyIllustration } from '../components/illustrations/EmptyStateIllustrations';
import { formatNumber, truncate } from '../utils/format';
import { PRODUCT_CATEGORIES } from '../utils/constants';

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

  // FIX: Reset loading AND page to 1 whenever search/category/page changes
  useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const params = { page, limit: 12 };
    if (selectedCategory !== 'all') params.category = selectedCategory;
    if (searchQuery) params.search = searchQuery;

    let cancelled = false;
    fetchProducts(params)
      .then((response) => {
        if (cancelled) return;
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
        if (cancelled) return;
        console.error('Failed to fetch products:', error);
        toast.error('Failed to load products');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, selectedCategory, searchQuery]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
  };

  const goToPage = (p) => {
    setPage(p);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heading = searchQuery
    ? `Search results for "${truncate(searchQuery, 40)}"`
    : 'Trending Products';

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <HeroBanner />

      <nav
        className="mt-8 sm:mt-12 mb-6 sm:mb-8 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100"
        aria-label="Product categories"
      >
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              aria-pressed={selectedCategory === cat}
              className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium capitalize transition-colors min-h-[36px] ${
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      <div id="products" className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1 scroll-mt-24">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            {heading}
          </h2>
          <div className="w-20 h-1 bg-teal-500 rounded mt-2" aria-hidden="true"></div>
        </div>
        {!loading && (
          <span className="text-sm text-gray-500" aria-live="polite">
            {formatNumber(total)} {total === 1 ? 'product' : 'products'} found
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonList count={8} />
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {pages > 1 && (
            <nav
              className="mt-10 flex justify-center items-center gap-1.5 flex-wrap"
              aria-label="Pagination"
            >
              <button
                onClick={() => goToPage(1)}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                aria-label="First page"
              >
                First
              </button>
              <button
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                aria-label="Previous page"
              >
                Prev
              </button>

              {getPageNumbers(page, pages).map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 font-bold" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    aria-label={`Page ${item}`}
                    aria-current={page === item ? 'page' : undefined}
                    className={`w-9 h-9 min-w-[44px] min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                      page === item ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => goToPage(Math.min(pages, page + 1))}
                disabled={page === pages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                aria-label="Next page"
              >
                Next
              </button>
              <button
                onClick={() => goToPage(pages)}
                disabled={page === pages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                aria-label="Last page"
              >
                Last
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-12 sm:py-20 bg-gray-50 rounded-2xl border border-gray-100 px-4">
          <SearchEmptyIllustration className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4" />
          <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">No results found</h3>
          {searchQuery ? (
            <p className="text-gray-500 max-w-md mx-auto">
              We couldn't find any products matching "<span className="font-semibold text-gray-700">{truncate(searchQuery, 30)}</span>".
              Try checking your spelling or using more general terms.
            </p>
          ) : (
            <p className="text-gray-500 max-w-md mx-auto">
              No products available in this category right now. Try a different category.
            </p>
          )}
        </div>
      )}
    </main>
  );
};

export default HomePage;
