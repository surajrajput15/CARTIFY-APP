import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts } from '../services/productsApi';
import HeroBanner from '../components/HeroBanner';
import ShopByCategory from '../components/ShopByCategory';
import ProductCard from '../components/ProductCard';
import { SkeletonList } from '../components/Skeleton';
import { SearchEmptyIllustration } from '../components/illustrations/EmptyStateIllustrations';
import { isNetworkError } from '../utils/apiError';
import { formatNumber, truncate, titleCase } from '../utils/format';
import { logError } from '../utils/logger';
import HomeSections from '../components/HomeSections';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import useSeo from '../hooks/useSeo';
import { useBackendStatus } from '../context/BackendStatusContext';

// Whitelisted ?sort= values (F-17) — anything else falls back to 'newest'.
const SORT_VALUES = ['newest', 'price_asc', 'price_desc', 'rating'];

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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const { isOffline, retryCount } = useBackendStatus();
  const wasOfflineRef = useRef(false);

  // Self-healing: auto-refetch products when backend recovers from cold start/outage
  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      if (fetchError) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-refetch when backend comes online
        setRetryKey((k) => k + 1);
      }
    }
  }, [isOffline, fetchError]);

  // Refetch when manual retry is clicked in the banner
  const prevRetryCountRef = useRef(retryCount);
  useEffect(() => {
    if (prevRetryCountRef.current !== retryCount) {
      prevRetryCountRef.current = retryCount;
      if (fetchError) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- manual retry from status banner
        setRetryKey((k) => k + 1);
      }
    }
  }, [retryCount, fetchError]);

  // F-12: the URL is the single source of truth for the whole result view —
  // ?search= ?category= and ?page= are read straight from it (Navbar rail,
  // ShopByCategory cards and search all drive these params), so filters
  // deep-link, survive refresh and the back button restores the exact view.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || 'all';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  // F-17: sort + price range are URL params too (?sort= ?min= ?max=), so the
  // whole result view stays shareable/deep-linkable. Unknown values fall back
  // to the defaults (never trust a URL).
  const sortParam = searchParams.get('sort') || 'newest';
  const sortValue = SORT_VALUES.includes(sortParam) ? sortParam : 'newest';
  const minParam = searchParams.get('min') || '';
  const maxParam = searchParams.get('max') || '';

  // Route title & dynamic SEO reflect the active view: default, category filter or search.
  useSeo({
    title: searchQuery
      ? `Search: "${searchQuery}"`
      : selectedCategory !== 'all'
        ? `${titleCase(selectedCategory)} Collection`
        : 'Your Premium Shopping Destination',
    description: selectedCategory !== 'all'
      ? `Shop our curated collection of high-quality ${selectedCategory} products with fast free delivery and secure Razorpay payment.`
      : 'Cartify is your premium destination for top-quality electronics, fashion, accessories, furniture, beauty products, and more. Shop now with secure checkout.',
    canonical: selectedCategory !== 'all' ? `/?category=${selectedCategory}` : '/',
  });

  // F-13: exactly one effect owns fetching. The old category/page sync
  // effects re-triggered state on every filter change and duplicated fetches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch cycle opens with its loading/error state
    setLoading(true);
    setFetchError(null);
    const params = { page, limit: 12 };
    if (selectedCategory !== 'all') params.category = selectedCategory;
    if (searchQuery) params.search = searchQuery;
    if (sortValue !== 'newest') params.sort = sortValue;
    if (minParam !== '') params.minPrice = minParam;
    if (maxParam !== '') params.maxPrice = maxParam;

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
        setFetchError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        // Network errors: show inline empty state (BackendStatusBanner
        // already surfaces the offline status to the user).
        // Server errors: log to console so devs can investigate.
        if (isNetworkError(error)) {
          setFetchError('network');
          setProducts([]);
          setTotal(0);
        } else {
          logError('Failed to fetch products:', error);
          setFetchError('server');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, selectedCategory, searchQuery, sortValue, minParam, maxParam, retryKey]);

  const goToPage = (p) => {
    // Page lives in the URL (F-12): rewrite only ?page= so ?category=/?search=
    // survive, and drop it entirely for page 1 to keep URLs canonical.
    const next = new URLSearchParams(searchParams);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setSearchParams(next);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // F-17: changing sort/price returns to page 1 so the new result set starts
  // at the top (same contract the category/search writers already have).
  const applySort = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'newest') next.delete('sort');
    else next.set('sort', value);
    next.delete('page');
    setSearchParams(next);
  };

  // Uncontrolled price inputs: typing must not hit the network per keystroke —
  // Apply commits them to the URL (keys remount the fields when the URL
  // changes underneath, e.g. the back button).
  const minRef = useRef(null);
  const maxRef = useRef(null);
  const applyPriceFilter = () => {
    const next = new URLSearchParams(searchParams);
    const commit = (key, input) => {
      const raw = input?.value?.trim() ?? '';
      const n = Number(raw);
      if (raw !== '' && Number.isFinite(n) && n >= 0) next.set(key, String(n));
      else next.delete(key);
    };
    commit('min', minRef.current);
    commit('max', maxRef.current);
    next.delete('page');
    setSearchParams(next);
  };

  const handleRetry = () => {
    setFetchError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  const heading = searchQuery
    ? `Search results for "${truncate(searchQuery, 40)}"`
    : selectedCategory !== 'all'
      ? `${titleCase(truncate(selectedCategory, 20))} Products`
      : 'All Products';
  const gridIds = useMemo(
    () => products.map((p) => String(p._id || p.id || '')).filter(Boolean),
    [products]
  );

  // F-45: the hero's product count comes from THIS fetch — the old duplicate
  // `limit: 1` request is gone. Only the unfiltered catalog total is shown;
  // filtered/errored/loading views fall back to the honest neutral copy.
  const catalogCount =
    !loading &&
    !fetchError &&
    !searchQuery &&
    selectedCategory === 'all' &&
    sortValue === 'newest' &&
    minParam === '' &&
    maxParam === ''
      ? total
      : null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      {!searchQuery && selectedCategory === 'all' && (
        <>
          <HeroBanner productCount={catalogCount} />
          <ShopByCategory />
          <HomeSections takenIds={gridIds} />
        </>
      )}

      <div id="products" className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1 scroll-mt-36">
        <div>
          {(!searchQuery && selectedCategory === 'all') ? (
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              {heading}
            </h2>
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {heading}
            </h1>
          )}
          <div className="w-20 h-1 bg-teal-500 rounded mt-2" aria-hidden="true"></div>
        </div>
        {!loading && fetchError !== 'network' && (
          <span className="text-sm text-gray-600 font-medium" aria-live="polite">
            {formatNumber(total)} {total === 1 ? 'product' : 'products'} found
          </span>
        )}
      </div>

      {/* F-17: server-side sort + price range — everything here is a URL param */}
      <Card className="mb-6 flex flex-wrap items-end gap-3 border rounded-2xl p-3 sm:p-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          Sort by
          <select
            value={sortValue}
            onChange={(e) => applySort(e.target.value)}
            aria-label="Sort products"
            className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
            Min ₹
            <input
              key={`min-${minParam}`}
              ref={minRef}
              defaultValue={minParam}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="0"
              aria-label="Minimum price"
              className="w-24 min-h-[44px] rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
            Max ₹
            <input
              key={`max-${maxParam}`}
              ref={maxRef}
              defaultValue={maxParam}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Any"
              aria-label="Maximum price"
              className="w-24 min-h-[44px] rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <Button
            onClick={applyPriceFilter}
            className="min-h-[44px] rounded-lg px-4 text-sm font-bold transition-colors"
          >
            Apply
          </Button>
        </div>
      </Card>

      {loading ? (
        <SkeletonList count={8} />
      ) : fetchError === 'network' ? (
        <div role="alert" className="text-center py-12 sm:py-20 bg-gray-50 rounded-2xl border border-gray-100 px-4">
          <SearchEmptyIllustration className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4" />
          <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">Products could not load</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base mb-6">
            You appear to be offline or the server is unreachable. Check your connection and try again.
          </p>
          <Button
            onClick={handleRetry}
            className="px-6 py-3 rounded-lg font-bold transition-colors min-h-[44px] inline-flex items-center"
          >
            Try Again
          </Button>
        </div>
      ) : fetchError === 'server' ? (
        <div role="alert" className="text-center py-12 sm:py-20 bg-gray-50 rounded-2xl border border-gray-100 px-4">
          <SearchEmptyIllustration className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4" />
          <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">Products could not load</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base mb-6">
            The server had a problem responding. This is usually temporary — try again in a moment.
          </p>
          <Button
            onClick={handleRetry}
            className="px-6 py-3 rounded-lg font-bold transition-colors min-h-[44px] inline-flex items-center"
          >
            Try Again
          </Button>
        </div>
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
              {/* F-19: below sm only Prev / "Page X of Y" / Next — numeric row from sm up */}
              <button
                onClick={() => goToPage(1)}
                disabled={page === 1}
                className="hidden sm:inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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

              <span className="sm:hidden px-2 text-sm font-medium text-gray-600">
                Page {page} of {pages}
              </span>

              <span className="hidden sm:flex items-center gap-1.5">
                {getPageNumbers(page, pages).map((item, i) =>
                  item === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-gray-500 font-bold" aria-hidden="true">…</span>
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
              </span>

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
                className="hidden sm:inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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
              No products available in this category right now. Try a different category or clear active filters.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {(Boolean(searchQuery) || selectedCategory !== 'all' || minParam !== '' || maxParam !== '' || sortValue !== 'newest') && (
              <Button
                variant="outline"
                onClick={() => setSearchParams({})}
                className="px-5 py-2.5 rounded-xl font-bold min-h-[44px]"
              >
                Clear All Filters
              </Button>
            )}
            <Button
              onClick={() => {
                setSearchParams({});
                setTimeout(() => {
                  document.getElementById('shop-by-category')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-5 py-2.5 rounded-xl font-bold min-h-[44px]"
            >
              Browse Categories
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
