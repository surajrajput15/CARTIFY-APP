import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { fetchProducts } from '../services/productsApi';
import { isNetworkError } from '../utils/apiError';
import { HeroIllustration } from './illustrations/EmptyStateIllustrations';

const FALLBACK_COUNT = 1000; // reasonable estimate when API is unreachable

const HeroBanner = () => {
  const [productCount, setProductCount] = useState(null);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchProducts({ limit: 1 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        const count = Array.isArray(data) ? data.length : (data?.total ?? 0);
        setProductCount(count);
        setApiOk(true);
      })
      .catch((err) => {
        if (cancelled) return;
        // Network errors: fall back to a sensible default so the UI is never broken.
        if (isNetworkError(err)) {
          setProductCount(FALLBACK_COUNT);
          setApiOk(false);
        }
        // Other errors: silently set 0 (will show "Loading…" until next mount)
      });
    return () => { cancelled = true; };
  }, []);

  const handleShopNow = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Copy adapts based on whether we got a real count, are loading, or fell back.
  const productCountText =
    productCount === null
      ? 'top-quality products'
      : `${productCount.toLocaleString('en-IN')}${apiOk ? '+ products' : '+ curated products'}`;

  return (
    <div className="relative bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500 rounded-3xl overflow-hidden shadow-xl mb-10 border border-teal-500/20">

      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" aria-hidden="true"></div>

      <div className="relative flex flex-col md:flex-row items-center justify-between p-6 sm:p-8 md:p-14 gap-6 md:gap-8">

        {/* Left Side: Text and Button */}
        <div className="text-white space-y-4 md:space-y-5 md:w-3/5 z-10 text-center md:text-left">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
              Mega Sale Active
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight drop-shadow-sm">
            Upgrade Your <span className="text-teal-200">Tech</span> &amp; <span className="text-orange-200">Lifestyle</span>
          </h1>
          <p className="text-teal-100 text-sm sm:text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Get up to <span className="font-bold text-white text-base sm:text-lg">50% off</span> on top electronics, premium accessories, and home essentials. Limited time offer on <span className="font-bold text-white">{productCountText}</span>!
          </p>
          <button
            onClick={handleShopNow}
            className="mt-4 md:mt-6 inline-flex items-center gap-2 bg-white text-teal-700 font-extrabold py-3.5 px-8 sm:px-9 rounded-xl shadow-lg hover:bg-teal-50 hover:text-teal-800 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 active:translate-y-0 cursor-pointer min-h-[44px]"
            aria-label="Shop now and browse products"
          >
            Shop Now
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Right Side: Inline SVG Illustration */}
        <div className="mt-4 md:mt-0 md:w-2/5 flex justify-center z-10 w-full">
          <HeroIllustration className="w-full max-w-xs sm:max-w-sm h-56 sm:h-64 md:h-72" />
        </div>

      </div>
    </div>
  );
};

export default HeroBanner;