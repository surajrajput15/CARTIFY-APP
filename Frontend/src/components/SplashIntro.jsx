import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Laptop,
  Headphones,
  MapPin,
  Smartphone,
} from 'lucide-react';

/**
 * SplashIntro — the full-screen cinematic brand layer.
 *
 * Pure presentation: no timers, no navigation, no interaction. IntroGate owns
 * the lifecycle; this component only renders the staged sequence:
 *
 *   0.00s  veil fades in
 *   0.25s  CARTIFY wordmark
 *   0.85s  tagline
 *   1.50s  floating ecommerce icons (staggered, decorative)
 *   2.40s  "Shop. Manage. Track. Delivered."
 *
 * All entrances use `both` fill (see .intro-* in index.css), so nothing is
 * visible before its delay. On `exiting` the root swaps to `.intro-exit`
 * (fade + slight scale-up) to reveal the store already loaded underneath.
 */
const FLOAT_ICONS = [
  { Icon: ShoppingBag, pos: 'left-[7%] top-[14%]', float: 'hero-float', show: '' },
  { Icon: ShoppingCart, pos: 'right-[8%] top-[16%]', float: 'hero-float-slow', show: '' },
  { Icon: Package, pos: 'left-[9%] bottom-[17%]', float: 'hero-float-slow', show: '' },
  { Icon: Laptop, pos: 'right-[7%] bottom-[19%]', float: 'hero-float', show: '' },
  { Icon: Headphones, pos: 'left-[17%] top-[54%]', float: 'hero-float', show: 'hidden sm:block' },
  { Icon: MapPin, pos: 'right-[15%] top-[56%]', float: 'hero-float-slow', show: 'hidden sm:block' },
  { Icon: Smartphone, pos: 'right-[9%] top-[37%]', float: 'hero-float', show: 'hidden lg:block' },
];

const ICON_IN_START_MS = 1500;
const ICON_STAGGER_MS = 80;
const FLOAT_CYCLE_S = 0.7;

const SplashIntro = ({ exiting = false }) => (
  <div
    className={`fixed inset-0 z-[100] overflow-hidden bg-[#030712] ${exiting ? 'intro-exit' : 'intro-veil'}`}
  >
    {/* Radial brand glow — gradient only, no blur filter (cheap to composite). */}
    <div
      aria-hidden="true"
      className="hero-glow absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(13,148,136,0.18),transparent_70%)]"
    />

    {/* Decorative ecommerce ecosystem: float loops reuse the existing hero-*
        keyframes. Entrance wrapper and float wrapper are separate elements so
        their transforms never fight over the same property. */}
    {FLOAT_ICONS.map(({ Icon, pos, float, show }, i) => (
      <div
        key={i}
        aria-hidden="true"
        className={`intro-icon-in absolute ${pos} ${show} text-teal-400 pointer-events-none select-none`}
        style={{ animationDelay: `${ICON_IN_START_MS + i * ICON_STAGGER_MS}ms` }}
      >
        <div
          className={`${float} w-7 h-7 sm:w-9 sm:h-9 lg:w-11 lg:h-11`}
          style={{ animationDelay: `${(i % 3) * FLOAT_CYCLE_S}s` }}
        >
          <Icon className="w-full h-full" strokeWidth={1.5} />
        </div>
      </div>
    ))}

    <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
      <h1 className="intro-word font-extrabold uppercase leading-none tracking-[0.14em] text-white text-[clamp(2.4rem,11vw,4.5rem)]">
        Cartify<span className="text-teal-400">.</span>
      </h1>

      <p className="intro-tagline mt-5 sm:mt-6 font-medium tracking-wide text-white/70 text-[clamp(0.85rem,3.6vw,1.1rem)]">
        Your Modern Shopping Experience
      </p>

      <p className="intro-message mt-9 sm:mt-11 font-semibold tracking-wide text-teal-300 text-[clamp(0.72rem,3vw,0.95rem)]">
        Shop. Manage. Track. Delivered.
      </p>
    </div>
  </div>
);

export default SplashIntro;
