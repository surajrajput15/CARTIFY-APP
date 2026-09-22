import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Shirt, Footprints, Watch, Armchair, Sparkles, LayoutGrid, ArrowRight
} from 'lucide-react';
import { fetchCategories } from '../services/categoriesApi';
import { PRODUCT_CATEGORIES } from '../utils/constants';

const ICON_MAP = {
  electronics: Cpu,
  clothing: Shirt,
  footwear: Footprints,
  accessories: Watch,
  furniture: Armchair,
  beauty: Sparkles,
};
const FALLBACK = LayoutGrid;

const ACCENT = {
  electronics: 'from-blue-500 to-cyan-400',
  clothing: 'from-fuchsia-500 to-pink-400',
  footwear: 'from-orange-500 to-amber-400',
  accessories: 'from-violet-500 to-purple-400',
  furniture: 'from-emerald-500 to-teal-400',
  beauty: 'from-rose-500 to-red-400',
};
const FALLBACK_ACCENT = 'from-teal-500 to-teal-400';

const ShopByCategory = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchCategories(true)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) && res.data.length
          ? res.data.filter((c) => c && typeof c.name === 'string')
          : [];
        setCategories(list);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  // Prefer the API taxonomy; fall back to the canonical list when the API is
  // empty (never show a stuck spinner or an empty grid).
  const items = categories.length > 0
    ? categories
    : PRODUCT_CATEGORIES.map((name) => ({ name, slug: name }));

  const go = (slug) => {
    navigate(`/?category=${encodeURIComponent(String(slug || '').toLowerCase())}`);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="mt-8 sm:mt-12 mb-8" aria-labelledby="shop-by-category-heading">
      <div className="mb-4 sm:mb-6 flex items-end justify-between">
        <div>
          <h2 id="shop-by-category-heading" className="text-lg sm:text-2xl font-bold text-gray-800">
            Shop by Category
          </h2>
          <div className="w-20 h-1 bg-teal-500 rounded mt-2" aria-hidden="true"></div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4" aria-label="Loading categories">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-gray-100 p-5 h-28 animate-pulse" aria-hidden="true" />
          ))}
        </div>
      ) : error && categories.length === 0 ? (
        <div role="alert" className="text-center py-8 bg-white rounded-2xl border border-gray-100 px-4">
          <p className="text-gray-600 mb-3 text-sm">Couldn't load categories.</p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {items.map((c) => {
            const key = String(c.slug || c.name || '').toLowerCase();
            const Icon = ICON_MAP[key] || FALLBACK;
            const gradient = ACCENT[key] || FALLBACK_ACCENT;
            return (
              <button
                key={c._id || key}
                type="button"
                onClick={() => go(c.slug || c.name)}
                aria-label={`Shop ${key} category`}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-4 sm:p-5 min-h-[120px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
              >
                <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-15 group-hover:opacity-25 transition-opacity`} aria-hidden="true" />
                <Icon className="text-teal-600 mb-2" size={26} aria-hidden="true" />
                <p className="font-bold text-gray-800 capitalize text-sm sm:text-base leading-snug">{c.name}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 group-hover:gap-1.5 transition-all">
                  Shop now <ArrowRight size={12} aria-hidden="true" />
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ShopByCategory;