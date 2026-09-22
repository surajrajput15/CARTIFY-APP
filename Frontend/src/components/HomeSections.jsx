import { useEffect, useMemo, useRef, useState } from 'react';
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

const ProductRow = ({ products, loading, compact = false }) => {
  if (loading) return <SkeletonListStub compact={compact} />;
  if (!products.length) return null;
  return (
    <div className={
      compact
        ? 'grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4'
        : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'
    }>
      {products.map((product) => (
        <ProductCard key={product._id || product.id} product={product} />
      ))}
    </div>
  );
};

const SkeletonListStub = ({ compact = false }) => (
  <div className={
    compact
      ? 'grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'
  }>
    {Array.from({ length: compact ? 4 : 4 }).map((_, i) => (
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
      to="/?category=all"
      className="inline-flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-lg min-h-[44px] hover:bg-teal-50 transition-colors"
    >
      Browse the Store <ArrowRight size={16} aria-hidden="true" />
    </Link>
  </section>
);

const productId = (p) => String(p?._id || p?.id || '');

// Pick up to `limit` products for `myKey`, keeping the ids this section already
// owns (claims.get(id) === myKey) so re-asserts stay stable, then filling from
// `pool` with ids nobody has claimed yet. `claims` is the shared Map.
const reserve = (pool, claims, myKey, preferred, limit) => {
  const owned = (id) => claims.get(id) === myKey;
  const wanted = [];
  const wantedIds = new Set();
  (preferred || []).forEach((p) => {
    const id = productId(p);
    if (id && owned(id) && !wantedIds.has(id)) {
      wanted.push(p);
      wantedIds.add(id);
    }
  });
  (pool || []).forEach((p) => {
    if (wanted.length >= limit) return;
    const id = productId(p);
    if (!id || wantedIds.has(id) || claims.has(id)) return;
    wanted.push(p);
    wantedIds.add(id);
  });
  return { picked: wanted, ids: wantedIds };
};

// Deterministic real-data ranking (the backend has no views/sales fields).
// Rates by authentic customer reviews — transparent, nothing fabricated.
const rankByReviews = (list) =>
  [...(list || [])].sort((a, b) => {
    const ac = Number(a.rating?.count) || 0;
    const bc = Number(b.rating?.count) || 0;
    if (bc !== ac) return bc - ac;
    return (Number(b.rating?.rate) || 0) - (Number(a.rating?.rate) || 0);
  });

const rankByRating = (list) =>
  [...(list || [])].sort((a, b) => {
    const ar = Number(a.rating?.rate) || 0;
    const br = Number(b.rating?.rate) || 0;
    if (br !== ar) return br - ar;
    return (Number(b.rating?.count) || 0) - (Number(a.rating?.count) || 0);
  });

// Featured Picks — evergreen, honest strip title only (no fake %/countdown).
// Ordered by real customer ratings, never duplicated across curated sections.
const FeaturedPicks = ({ taken, version, claim }) => {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);
  const poolRef = useRef(null);
  const pickedRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!poolRef.current) {
          const res = await fetchProducts({ limit: 40 });
          if (cancelled) return;
          const d = res.data;
          poolRef.current = Array.isArray(d) ? d : (d?.products ?? []);
        }
        const { picked } = reserve(rankByRating(poolRef.current), taken, 'featured', pickedRef.current, 4);
        if (cancelled) return;
        pickedRef.current = picked;
        setProducts(picked);
        claim('featured', picked.map(productId));
      } catch (err) {
        if (cancelled) return;
        if (!isNetworkError(err)) logError('FeaturedPicks fetch failed:', err);
        setError(true);
        setProducts([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, version]);

  return (
    <section className="mt-12 scroll-mt-36" aria-labelledby="featured-heading">
      <div id="featured-heading" className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles size={20} className="text-teal-600" aria-hidden="true" /> Featured Picks
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Top rated by real customer reviews.</p>
        </div>
        <Link to="/?category=all" className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap">
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
// recent views; guests get real top-reviewed products. No fake personalization,
// and never duplicated across curated sections.
const Recommendations = ({ taken, version, claim }) => {
  const { user } = useAuth();
  const { wishlist } = useWishlist();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);
  const guestPoolRef = useRef(null);
  const pickedRef = useRef([]);

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
          taken.forEach((_, id) => seen.add(id));
          pickedRef.current.forEach((p) => {
            const pid = productId(p);
            if (pid) seen.add(pid);
          });
          const rows = await Promise.all(
            signalCategories.map((cat) =>
              fetchProducts({ category: cat, limit: 8 }).catch(() => ({ data: { products: [] } }))
            )
          );
          if (cancelled) return;
          const pool = [];
          rows.forEach((res) => {
            const d = res.data;
            const arr = Array.isArray(d) ? d : (d?.products ?? []);
            (Array.isArray(arr) ? arr : []).forEach((p) => {
              const pid = productId(p);
              if (pid && !seen.has(pid)) { seen.add(pid); pool.push(p); }
            });
          });
          const { picked } = reserve(pool, taken, 'rec', pickedRef.current, 4);
          pickedRef.current = picked;
          setProducts(picked);
          claim('rec', picked.map(productId));
        } else {
          if (!guestPoolRef.current) {
            const res = await fetchProducts({ limit: 40 });
            if (cancelled) return;
            const d = res.data;
            guestPoolRef.current = Array.isArray(d) ? d : (d?.products ?? []);
          }
          const { picked } = reserve(rankByReviews(guestPoolRef.current), taken, 'rec', pickedRef.current, 4);
          pickedRef.current = picked;
          setProducts(picked);
          claim('rec', picked.map(productId));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, signalCategories, taken, version]);

  const titled = user?.id && signalCategories.length;
  const ready = products !== null;
  if (ready && !products.length) return null;

  return (
    <section className="mt-12 scroll-mt-36" aria-labelledby="rec-heading">
      <SectionHeader
        id="rec-heading"
        icon={Heart}
        title={titled ? 'Recommended For You' : 'Popular Picks'}
        subtitle={titled ? 'Based on your wishlist and browsing history.' : 'Most reviewed by real customers.'}
      />
      {error ? (
        <EmptyRow message="Couldn't load recommendations. Please retry." />
      ) : (
        <ProductRow products={products || []} loading={!ready} />
      )}
    </section>
  );
};

// Real view history stored locally (guest + user-scoped keys) — compact.
const RecentlyViewed = () => {
  const { user } = useAuth();
  const items = useMemo(() => getRecentViewed(user?.id).slice(0, 4), [user?.id]);
  if (!items.length) {
    return (
      <section className="mt-12 scroll-mt-36" aria-labelledby="recent-heading">
        <SectionHeader id="recent-heading" icon={Clock} title="Recently Viewed" />
        <EmptyRow message="Products you view will appear here." />
      </section>
    );
  }
  return (
    <section className="mt-12 scroll-mt-36" aria-labelledby="recent-heading">
      <SectionHeader
        id="recent-heading"
        icon={Clock}
        title="Recently Viewed"
        subtitle="Picks from your browsing history."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {items.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
};

// Real wishlist items from the account (signed-in only) — compact.
const FromWishlist = () => {
  const { user } = useAuth();
  const { wishlist, wishlistLoading } = useWishlist();

  if (!user) {
    return (
      <section className="mt-12 scroll-mt-36" aria-labelledby="wl-heading">
        <SectionHeader id="wl-heading" icon={Heart} title="From Your Wishlist" />
        <EmptyRow
          message="Your wishlist is empty. Tap the heart on any product to save it here."
          cta={<Link to="/?category=all" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-bold">Browse products <ArrowRight size={14} aria-hidden="true" /></Link>}
        />
      </section>
    );
  }

  if (!wishlistLoading && !wishlist?.length) {
    return (
      <section className="mt-12 scroll-mt-36" aria-labelledby="wl-heading">
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
    <section className="mt-12 scroll-mt-36" aria-labelledby="wl-heading">
      <SectionHeader
        id="wl-heading"
        icon={Heart}
        title="From Your Wishlist"
        action={<Link to="/wishlist" className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap">View wishlist →</Link>}
      />
      {!wishlistLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {items.map((product) => (
            <ProductCard key={product._id || product.productId || product.id} product={product} />
          ))}
        </div>
      ) : (
        <SkeletonListStub compact />
      )}
    </section>
  );
};

// Real past-order products (signed-in only) — compact. Order snapshots carry
// only {productId, title, price, ...} — resolve live products by id.
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
        const targets = ids.slice(0, 4);
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
    <section className="mt-12 scroll-mt-36" aria-labelledby="buyagain-heading">
      <SectionHeader
        id="buyagain-heading"
        icon={PackageCheck}
        title="Buy Again"
        subtitle="Re-order from your past purchases."
      />
      <ProductRow products={products || []} loading={!ready} compact />
    </section>
  );
};

const COLLECTIONS = [
  { key: 'Electronics', category: 'electronics', icon: Cpu, gradient: 'from-blue-500 to-cyan-500' },
  { key: 'Fashion', category: 'clothing', icon: Shirt, gradient: 'from-fuchsia-500 to-pink-500' },
  { key: 'Beauty', category: 'beauty', icon: Flower2, gradient: 'from-rose-500 to-red-500' },
  { key: 'Home & Furniture', category: 'furniture', icon: Home, gradient: 'from-emerald-500 to-teal-500' },
];

// Real category-filtered products for themed collections. Tabs keep the page
// compact instead of stacking a huge row per category.
const CategoryCollections = ({ taken, version, claim }) => {
  const [activeKey, setActiveKey] = useState(COLLECTIONS[0].key);
  const active = COLLECTIONS.find((c) => c.key === activeKey) || COLLECTIONS[0];

  return (
    <section className="mt-12 scroll-mt-36" aria-labelledby="collections-heading">
      <div className="mb-4">
        <h2 id="collections-heading" className="text-lg sm:text-xl font-bold text-gray-800">
          Shop by Collection
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Curated from real categories.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Product collections">
        {COLLECTIONS.map(({ key, icon: Icon }) => {
          const selected = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveKey(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold min-h-[44px] transition-colors ${
                selected
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <Icon size={15} aria-hidden="true" /> {key}
            </button>
          );
        })}
      </div>

      <CollectionRow key={active.category} title={active.key} category={active.category} icon={active.icon} gradient={active.gradient} taken={taken} version={version} claim={claim} />
    </section>
  );
};

const CollectionRow = ({ title, category, icon: Icon, gradient, taken, version, claim }) => {
  const [products, setProducts] = useState(null);
  const poolRef = useRef(null);
  const pickedRef = useRef([]);

useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!poolRef.current) {
          const res = await fetchProducts({ category, limit: 40 });
          if (cancelled) return;
          const d = res.data;
          poolRef.current = Array.isArray(d) ? d : (d?.products ?? []);
        }
        const { picked } = reserve(poolRef.current, taken, `collection-${category}`, pickedRef.current, 4);
        if (cancelled) return;
        pickedRef.current = picked;
        setProducts(picked);
        claim(`collection-${category}`, picked.map(productId));
      } catch (err) {
        if (cancelled) return;
        if (!isNetworkError(err)) logError(`Collection ${category} failed:`, err);
        setProducts([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, taken, version]);

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
      <ProductRow products={products || []} loading={products === null} compact />
    </div>
  );
};

const HomeSections = ({ takenIds = [] }) => {
  const claimsRef = useRef(new Map());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const claims = claimsRef.current;
    let changed = false;
    (takenIds || []).forEach((id) => {
      if (id && claims.get(id) !== 'grid') { claims.set(id, 'grid'); changed = true; }
    });
    if (changed || version === 0) setVersion((v) => v + 1);
  }, [takenIds]);

  const claim = (owner, ids) => {
    const claims = claimsRef.current;
    let changed = false;
    (ids || []).forEach((id) => {
      if (!id) return;
      const cur = claims.get(id);
      if (cur === undefined) { claims.set(id, owner); changed = true; }
      else if (cur !== owner) changed = true;
    });
    if (changed) setVersion((v) => v + 1);
  };

  return (
    <>
      {/* Order: Recommended → Featured → Recently → Wishlist → Buy Again →
          Collections → Promo → Trust. Sections share one `claims` map so each
          product appears at most once across the main grid + curated zone. */}
      <Recommendations taken={claimsRef.current} version={version} claim={claim} />
      <FeaturedPicks taken={claimsRef.current} version={version} claim={claim} />
      <RecentlyViewed />
      <FromWishlist />
      <BuyAgain />
      <CategoryCollections taken={claimsRef.current} version={version} claim={claim} />
      <SecondaryPromo />
      <TrustStrip />
    </>
  );
};

export default HomeSections;
export { FeaturedPicks, Recommendations, RecentlyViewed, FromWishlist, BuyAgain, CategoryCollections, SecondaryPromo, TrustStrip };
