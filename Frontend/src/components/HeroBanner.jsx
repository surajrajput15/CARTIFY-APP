import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  Headphones,
  Zap,
  Smartphone,
  Monitor,
  Truck,
  Package,
  Sparkles,
  Star,
} from 'lucide-react';
import { fetchProducts } from '../services/productsApi';
import { formatNumber } from '../utils/format';
import { isNetworkError } from '../utils/apiError';
import { HeroIllustration } from './illustrations/EmptyStateIllustrations';

/**
 * Promo slides. The headline renders word-by-word with a springy entrance, and
 * each slide carries its own accent gradient + floating commerce glyphs so the
 * hero feels alive without loading any external images. All animation is CSS
 * (see index.css — hero-* keyframes), and respects prefers-reduced-motion.
 */
const SLIDES = [
  {
    id: 'tech',
    badge: 'New Arrivals',
    badgeClass: 'text-orange-200 border-orange-300/30 bg-orange-500/10',
    pingClass: 'bg-orange-400',
    dotClass: 'bg-orange-500',
    gradient: 'from-teal-800 via-teal-600 to-teal-500',
    words: [
      { text: 'Upgrade', accent: false },
      { text: 'Your', accent: false },
      { text: 'Tech', accent: true, accentClass: 'text-teal-200' },
      { text: '&', accent: false },
      { text: 'Lifestyle', accent: true, accentClass: 'text-orange-200' },
    ],
    floaters: [
      { icon: Headphones, className: 'left-[6%] top-[12%]', anim: 'hero-float-slow' },
      { icon: Zap, className: 'right-[8%] top-[18%]', anim: 'hero-float' },
      { icon: Monitor, className: 'left-[10%] bottom-[16%]', anim: 'hero-float' },
      { icon: Smartphone, className: 'right-[12%] bottom-[24%]', anim: 'hero-float-slow' },
    ],
  },
  {
    id: 'sale',
    badge: 'Mega Season Sale',
    badgeClass: 'text-red-200 border-red-300/30 bg-red-500/10',
    pingClass: 'bg-red-400',
    dotClass: 'bg-red-500',
    gradient: 'from-rose-700 via-rose-500 to-orange-400',
    words: [
      { text: 'Deals', accent: true, accentClass: 'text-yellow-200' },
      { text: 'That', accent: false },
      { text: 'Spark', accent: false },
      { text: 'Joy', accent: true, accentClass: 'text-white' },
    ],
    floaters: [
      { icon: Sparkles, className: 'left-[6%] top-[14%]', anim: 'hero-float' },
      { icon: Star, className: 'right-[7%] top-[22%]', anim: 'hero-float-slow' },
      { icon: Zap, className: 'left-[11%] bottom-[20%]', anim: 'hero-float-slow' },
      { icon: Star, className: 'right-[10%] bottom-[18%]', anim: 'hero-float' },
    ],
  },
  {
    id: 'shipping',
    badge: 'Free Fast Delivery',
    badgeClass: 'text-sky-200 border-sky-300/30 bg-sky-500/10',
    pingClass: 'bg-sky-400',
    dotClass: 'bg-sky-500',
    gradient: 'from-indigo-700 via-violet-600 to-fuchsia-500',
    words: [
      { text: 'Shop', accent: false },
      { text: 'Anywhere,', accent: false },
      { text: 'Free', accent: true, accentClass: 'text-violet-200' },
      { text: 'Delivery', accent: true, accentClass: 'text-white' },
    ],
    floaters: [
      { icon: Truck, className: 'left-[6%] top-[18%]', anim: 'hero-float' },
      { icon: Package, className: 'right-[7%] top-[12%]', anim: 'hero-float-slow' },
      { icon: Truck, className: 'left-[10%] bottom-[18%]', anim: 'hero-float-slow' },
      { icon: Package, className: 'right-[11%] bottom-[26%]', anim: 'hero-float' },
    ],
  },
];

const SLIDE_INTERVAL_MS = 5000;

const SlidePanel = ({ slide, animate, productCountText, onShopNow }) => (
  <div className="relative w-full shrink-0">
    {/* Animated rotating gradient background (CSS keyframe) */}
    <div
      className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} ${animate ? 'hero-grad-animate' : ''}`}
      aria-hidden="true"
    ></div>

    {/* Soft radial glow */}
    <div
      className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-white via-transparent to-transparent hero-glow"
      aria-hidden="true"
    ></div>

    {/* Floating commerce glyphs */}
    <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
      {slide.floaters.map((floater, index) => {
        const Icon = floater.icon;
        return (
          <span
            key={`${slide.id}-${index}`}
            className={`absolute ${floater.className} ${animate ? floater.anim : ''} text-4xl sm:text-5xl md:text-6xl select-none drop-shadow-lg`}
            style={{ animationDirection: `${index % 2 === 0 ? 'alternate' : 'normal'}` }}
          >
            <Icon strokeWidth={1.5} aria-hidden="true" />
          </span>
        );
      })}
    </div>

    <div className="relative flex flex-col md:flex-row items-center justify-between px-6 sm:px-8 md:px-14 pt-6 sm:pt-8 md:pt-14 pb-24 md:pb-20 gap-6 md:gap-8">
      {/* Left Side: Text and Button */}
      <div className="text-white z-10 md:w-3/5 text-center md:text-left">
        <div
          className={`inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border ${slide.badgeClass} ${animate ? 'hero-rise' : ''}`}
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${slide.pingClass} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${slide.dotClass}`}></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {slide.badge}
          </span>
        </div>

        {/* Word-by-word headline with springy entrance */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight drop-shadow-sm mt-4">
          {slide.words.map((word, index) => (
            <span
              key={index}
              className={`hero-word inline-block mr-[0.22em] ${word.accent ? word.accentClass : ''}`}
              style={{ animationDelay: `${0.08 + index * 0.09}s` }}
            >
              {word.text}
            </span>
          ))}
        </h1>

        <p
          className={`text-teal-100 text-sm sm:text-base md:text-lg max-w-xl font-medium leading-relaxed ${animate ? 'hero-rise' : ''}`}
          style={{ animationDelay: '0.55s' }}
        >
          {slide.id === 'tech' ? (
            <>Explore top electronics, premium accessories, and home essentials across{' '}
              <span className="font-bold text-white">{productCountText}</span>.</>
          ) : slide.id === 'sale' ? (
            <>Limited-time discounts on smartphones, laptops, and lifestyle gear — grab{' '}
              <span className="font-bold text-white">{productCountText}</span>.</>
          ) : (
            <>Fast, reliable doorstep delivery on every order — browse{' '}
              <span className="font-bold text-white">{productCountText}</span>.</>
          )}
        </p>

        <button
          onClick={onShopNow}
          className={`mt-4 md:mt-6 inline-flex items-center gap-2 bg-white text-teal-700 font-extrabold py-3 px-8 sm:px-10 rounded-xl shadow-lg hover:bg-teal-50 hover:text-teal-800 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 active:translate-y-0 cursor-pointer min-h-[44px] ${animate ? 'hero-bounce-in' : ''}`}
          style={{ animationDelay: '0.6s' }}
          aria-label="Shop now and browse products"
        >
          {slide.id === 'sale' ? 'Grab The Deal' : 'Shop Now'}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Right Side: Inline SVG Illustration with spring entrance */}
      <div
        className={`mt-4 md:mt-0 md:w-2/5 flex justify-center z-10 w-full ${animate ? 'hero-bounce-in' : ''}`}
        style={{ animationDelay: '0.4s' }}
      >
        <HeroIllustration className="w-full max-w-xs sm:max-w-sm h-56 sm:h-64 md:h-72" />
      </div>
    </div>
  </div>
);

const HeroBanner = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [productCount, setProductCount] = useState(null);
  const [apiOk, setApiOk] = useState(true);
  const [inView, setInView] = useState(false);
  const [tick, setTick] = useState(0);
  const containerRef = useRef(null);
  const touchStartX = useRef(null);
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  /* Product count — only ever shown when it came from the real API. Offline /
     loading keeps neutral copy instead of fabricating a number. */
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
        if (isNetworkError(err)) {
          setProductCount(null);
          setApiOk(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  /* Entrance animations only run once the hero actually scrolls into view. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !('IntersectionObserver' in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setInView(true); observer.disconnect(); }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Auto-advance — paused on hover, when toggled off, or before in view. */
  useEffect(() => {
    if (!autoPlay || paused || !inView || reducedMotion) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % SLIDES.length);
      setTick((t) => t + 1);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoPlay, paused, inView, reducedMotion]);

  const goTo = (index) => {
    const length = SLIDES.length;
    setActiveIndex(((index % length) + length) % length);
    setTick((t) => t + 1);
  };
  const next = () => goTo(activeIndex + 1);
  const prev = () => goTo(activeIndex - 1);

  /* Touch swipe (mobile) */
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) < 40) { touchStartX.current = null; return; }
    if (delta < 0) next(); else prev();
    touchStartX.current = null;
  };

  const handleShopNow = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  const productCountText =
    apiOk && productCount !== null
      ? `${formatNumber(productCount)}+ products`
      : 'top-quality products';

  return (
    <section
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative overflow-hidden rounded-3xl shadow-xl mb-10 border border-teal-500/20 bg-gradient-to-r from-teal-800 via-teal-600 to-teal-500"
      aria-label="Feature highlights carousel"
      aria-roledescription="carousel"
    >
      {/* Sliding track: next travels right-to-left, prev travels left-to-right.
          w-full pins the track to exactly one panel wide and its w-full shrink-0
          children overflow to the right, so translateX percentages resolve
          against one panel and -100% steps by exactly one slide. */}
      <div
        className="flex w-full"
        style={{
          transform: `translateX(-${activeIndex * 100}%)`,
          transition: reducedMotion
            ? 'none'
            : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {SLIDES.map((slide, index) => (
          <SlidePanel
            key={`${slide.id}-${tick}`}
            slide={slide}
            animate={inView && index === activeIndex}
            productCountText={productCountText}
            onShopNow={handleShopNow}
          />
        ))}
      </div>

      {/* Controls: fixed overlay strip so they never slide with the content */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true"></div>
        <div className="relative flex items-center justify-between px-6 sm:px-8 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center gap-2" role="tablist" aria-label="Choose slide">
            {SLIDES.map((s, index) => (
              <button
                key={s.id}
                onClick={() => goTo(index)}
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Go to slide ${index + 1}: ${s.badge}`}
                className="w-9 h-9 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center p-0"
              >
                <span
                  className={`block w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'bg-white scale-125'
                      : 'bg-white/50 hover:bg-white/80'
                  }`}
                ></span>
              </button>
            ))}
          </div>

          {/* Autoplay toggle */}
          <button
            onClick={() => setAutoPlay((v) => !v)}
            aria-pressed={autoPlay}
            aria-label={autoPlay ? 'Pause automatic slide rotation' : 'Play automatic slide rotation'}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
          >
            {autoPlay ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
