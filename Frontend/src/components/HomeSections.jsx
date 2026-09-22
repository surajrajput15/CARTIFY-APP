import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, RotateCcw, Headset, CreditCard, Clock,
  Heart, PackageCheck, Sparkles, BadgeCheck, Shirt, Cpu,
  Flower2, Home, ArrowRight
} from 'lucide-react';
import ProductCard from './ProductCard';
import { SkeletonCard } from './Skeleton';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/authContext';
import { getRecentViewed } from '../utils/recentlyViewed';
import { fetchProducts, fetchProductById } from '../services/productsApi';
import { isNetworkError } from '../utils/apiError';
import { logError } from '../utils/logger';
import { SUPPORT_EMAIL, SHIPPING_CONFIG } from '../utils/constants';
import { fetchMyOrders } from '../services/ordersApi';

const SectionHeader = ({ icon: Icon, title, subtitle, action, id }) => (
  <div className="mb-4 flex items-start justify-between gap-2">
    <div>
      <h2 id={id} className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
        <Icon size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
        {title}
      </h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const ProductRow = ({ products, loading }) => {
  if (loading) return <SkeletonListStub />;
  if (!products.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard key={product._id || product.id} product={product} />
      ))}
    </div>
  );
};

const SkeletonListStub = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

const EmptyRow = ({ message, cta }) => (
  <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 py-10 px-6 text-center">
    <p className="text-gray-500 text-sm mb-3">{message}</p>
    {cta}
  </div>
);

const TrustStrip = () => {
  const items = [
    { icon: Truck, title: 'Fast Delivery', desc: `Ships in ${SHIPPING_CONFIG.ESTIMATED_DELIVERY_DAYS} business days` },
    { icon: CreditCard, title: 'Secure Payments', desc: 'Encrypted Razorpay checkout' },
    { icon: RotateCcw, title: 'Easy Returns', desc: 'Simple return process' },
    { icon: BadgeCheck, title: 'Genuine Products', desc: '100% authentic brands' },
    { icon: Headset, title: 'Customer Support', desc: `${SUPPORT_EMAIL}` },
  ];
  return (
    <section className="mt-12" aria-label="Why shop with us">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <Icon size={22} className="text-teal-600 mx-auto mb-2" aria-hidden="true" />
            <p className="font-semibold text-gray-800 text-sm">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate" title={desc}>{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const SecondaryPromo = () => (
  <section
    className="mt-12 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-8 sm:px-10 text-center overflow-hidden relative"
    aria-labelledby="promo-heading"
  >
    <div className="absolute -left-8 -top-10 w-44 h-44 rounded-full bg-white/10" aria-hidden="true" />
    <div className="absolute -right-8 -bottom-12 w-52 h-52 rounded-full bg-white/10" aria-hidden="true" />
    <Sparkles size={26} className="mx-auto mb-3" aria-hidden="true" />
    <h2 id="promo-heading" className="text-xl sm:text-2xl font-bold mb-1">Explore More. Shop Smarter.</h2>
    <p className="text-teal-50 text-sm sm:text-base mb-5 max-w-lg mx-auto">
      Discover fresh picks across fashion, electronics, beauty and home essentials — all in one place.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-lg min-h-[44px] hover:bg-teal-50 transition-colors"
    >
      Browse the Store <ArrowRight size={16} aria-hidden="true" />
    </Link>
  </section>
);

// Featured Picks — evergreen. The backend has no MRP/discount fields, so this
// is real products with a strip title only: no fake % or countdown.
const FeaturedPicks = () => {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProducts({ limit: 8, sort: 'rating' })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        const list = Array.isArray(d) ? d : (d?.products ?? []);
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!isNetworkError(err)) logError('FeaturedPicks fetch failed:', err);
        setError(true);
        setProducts([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mt-12" aria-labelledby="featured-heading">
      <div id="featured-heading" className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles size={20} className="text-teal-600" aria-hidden="true" /> Featured Picks
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Real products, no fake deals.</p>
        </div>
        <Link to="/" className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap">
          View all →
        </Link>
      </div>
      {error ? (
        <EmptyRow message="Couldn't load featured picks. Please retry." />
      ) : (
        <ProductRow products={products || []} loading={products === null} />
      )}
    </section>
  );
};

// Recommendations: signed-in users signal category interest from wishlist +
// recent views; guests get real "Popular Picks". No fake personalization.
const Recommendations = () => {
  const { user } = useAuth();
  const { wishlist } = useWishlist();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);

  const signalCategories = useMemo(() => {
    const counts = new Map();
    const add = (cat) => {
      if (!cat) return;
      const key = String(cat).trim().toLowerCase();
      if (key && key !== 'all') counts.set(key, (counts.get(key) || 0) + 1);
    };
    (wishlist || []).forEach((p) => add(p?.category));
    getRecentViewed(user?.id).forEach((p) => add(p?.category));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);
  }, [user?.id, wishlist]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (user?.id && signalCategories.length) {
          const seen = new Set();
          const rows = await Promise.all(
            signalCategories.map((cat) =>
              fetchProducts({ category: cat, limit: 4 }).catch(() => ({ data: { products: [] } }))
            )
          );
          const list = [];
          rows.forEach((res) => {
            const d = res.data;
            const arr = Array.isArray(d) ? d : (d?.products ?? []);
            (Array.isArray(arr) ? arr : []).forEach((p) => {
              const pid = String(p._id || p.id);
              if (!seen.has(pid)) { seen.add(pid); list.push(p); }
            });
          });
          if (cancelled) return;
          setProducts(list.length ? list : null);
        } else {
          const res = await fetchProducts({ limit: 8 });
          const d = res.data;
          const list = Array.isArray(d) ? d : (d?.products ?? []);
          if (cancelled) return;
          setProducts(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (cancelled) return;
        if (!isNetworkError(err)) logError('Recommendations fetch failed:', err);
        setError(true);
        setProducts([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id, signalCategories]);

  const titled = user?.id && signalCategories.length;
  const ready = products !== null;
  if (ready && !products.length) return null;

  return (
    <section className="mt-12" aria-labelledby="rec-heading">
      <SectionHeader
        id="rec-heading"
        icon={Heart}
        title={titled ? 'Recommended For You' : 'Popular Picks'}
        subtitle={titled ? 'Based on your wishlist and browsing history.' : 'Most-loved products this week.'}
      />
      {error ? (
        <EmptyRow message="Couldn't load recommendations. Please retry." />
      ) : (
        <ProductRow products={products || []} loading={!ready} />
      )}
    </section>
  );
};

// Real view history stored locally (guest + user-scoped keys).
const RecentlyViewed = () => {
  const { user } = useAuth();
  const items = useMemo(() => getRecentViewed(user?.id), [user?.id]);
  if (!items.length) {
    return (
      <section className="mt-12" aria-labelledby="recent-heading">
        <SectionHeader id="recent-heading" icon={Clock} title="Recently Viewed" />
        <EmptyRow message="Products you view will appear here." />
      </section>
    );
  }
  return (
    <section className="mt-12" aria-labelledby="recent-heading">
      <SectionHeader
        id="recent-heading"
        icon={Clock}
        title="Recently Viewed"
        subtitle="Picks from your browsing history."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
};

// Real wishlist items from the account (signed-in only).
const FromWishlist = () => {
  const { user } = useAuth();
  const { wishlist, wishlistLoading } = useWishlist();

  if (!user) {
    return (
      <section className="mt-12" aria-labelledby="wl-heading">
        <SectionHeader id="wl-heading" icon={Heart} title="From Your Wishlist" />
        <EmptyRow
          message="Your wishlist is empty. Tap the heart on any product to save it here."
          cta={<Link to="/" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-bold">Browse products <ArrowRight size={14} aria-hidden="true" /></Link>}
        />
      </section>
    );
  }

  if (!wishlistLoading && !wishlist?.length) {
    return (
      <section className="mt-12" aria-labelledby="wl-heading">
        <SectionHeader id="wl-heading" icon={Heart} title="From Your Wishlist" />
        <EmptyRow
          message="Your wishlist is empty. Tap the heart on any product to save it here."
          cta={<Link to="/wishlist" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-bold">View wishlist <ArrowRight size={14} aria-hidden="true" /></Link>}
        />
      </section>
    );
  }

  const items = (wishlist || []).slice(0, 4);
  return (
    <section className="mt-12" aria-labelledby="wl-heading">
      <SectionHeader
        id="wl-heading"
        icon={Heart}
        title="From Your Wishlist"
        action={<Link to="/wishlist" className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap">View wishlist →</Link>}
      />
      {!wishlistLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {items.map((product) => (
            <ProductCard key={product._id || product.productId || product.id} product={product} />
          ))}
        </div>
      ) : (
        <SkeletonListStub />
      )}
    </section>
  );
};

// Real past-order products (signed-in only). Order snapshots carry only
// {productId, title, price, ...} — resolve live products by id for real
// images, prices and stock.
const BuyAgain = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    if (!user?.id) { setProducts([]); return; }
    let cancelled = false;
    fetchMyOrders(user.id)
      .then(async (res) => {
        if (cancelled) return;
        const orders = Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
        const seen = new Set();
        const ids = [];
        orders.forEach((order) => {
          (order?.orderItems || order?.items || []).forEach((line) => {
            const pid = line?.productId || line?._id || line?.id;
            if (pid && !seen.has(String(pid))) {
              seen.add(String(pid));
              ids.push(String(pid));
            }
          });
        });
        const targets = ids.slice(0, 8);
        const resolved = await Promise.all(
          targets.map((id) => fetchProductById(id).then((r) => r.data).catch(() => null))
        );
        if (cancelled) return;
        setProducts(resolved.filter(Boolean));
      })
      .catch((err) => {
        if (cancelled) return;
        if (!isNetworkError(err)) logError('BuyAgain fetch failed:', err);
        setProducts([]);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user?.id) return null;
  const ready = products !== null;
  const hasItems = ready && products.length > 0;
  if (ready && !hasItems) return null;

  return (
    <section className="mt-12" aria-labelledby="buyagain-heading">
      <SectionHeader
        id="buyagain-heading"
        icon={PackageCheck}
        title="Buy Again"
        subtitle="Re-order from your past purchases."
      />
      <ProductRow products={products || []} loading={!ready} />
    </section>
  );
};

const COLLECTIONS = [
  { key: 'Fashion', category: 'clothing', icon: Shirt, gradient: 'from-fuchsia-500 to-pink-500' },
  { key: 'Electronics', category: 'electronics', icon: Cpu, gradient: 'from-blue-500 to-cyan-500' },
  { key: 'Beauty', category: 'beauty', icon: Flower2, gradient: 'from-rose-500 to-red-500' },
  { key: 'Home & Furniture', category: 'furniture', icon: Home, gradient: 'from-emerald-500 to-teal-500' },
];

// Real category-filtered products for themed collections.
const CategoryCollections = () => {
  const active = COLLECTIONS.filter((c) => c.category);
  return (
    <section className="mt-12 space-y-10" aria-labelledby="collections-heading">
      <div className="mb-2">
        <h2 id="collections-heading" className="text-lg sm:text-xl font-bold text-gray-800">
          Shop by Collection
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Curated from real categories.</p>
      </div>
      {active.map(({ key, category, icon: Icon, gradient }) => (
        <CollectionRow key={category} title={key} category={category} icon={Icon} gradient={gradient} />
      ))}
    </section>
  );
};

const CollectionRow = ({ title, category, icon: Icon, gradient }) => {
  const [products, setProducts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchProducts({ category, limit: 4 })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        const list = Array.isArray(d) ? d : (d?.products ?? []);
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!isNetworkError(err)) logError(`Collection ${category} failed:`, err);
        setProducts([]);
      });
    return () => { cancelled = true; };
  }, [category]);

  if (products !== null && !products.length) return null;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
            <Icon size={16} aria-hidden="true" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <Link
          to={`/?category=${encodeURIComponent(category)}`}
          className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap inline-flex items-center gap-1"
        >
          View all <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <ProductRow products={products || []} loading={products === null} />
    </div>
  );
};

const HomeSections = () => (
  <>
    {/* Order per spec: Featured/Deals → Recommended → Recently Viewed →
        Wishlist → Buy Again → Category Collections → Promo → Trust. */}
    <FeaturedPicks />
    <Recommendations />
    <RecentlyViewed />
    <FromWishlist />
    <BuyAgain />
    <CategoryCollections />
    <SecondaryPromo />
    <TrustStrip />
  </>
);

export default HomeSections;
export { FeaturedPicks, Recommendations, RecentlyViewed, FromWishlist, BuyAgain, CategoryCollections, SecondaryPromo, TrustStrip };