import { useState, useEffect, useRef } from 'react';

/**
 * LazySection — defers rendering of expensive below-the-fold content
 * and its network calls until the viewport approaches (rootMargin: 350px).
 * Reserves a placeholder frame to prevent Cumulative Layout Shift (CLS).
 */
const LazySection = ({ children, placeholder = null, rootMargin = '350px' }) => {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  const ref = useRef(null);

  useEffect(() => {
    if (inView || typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [inView, rootMargin]);

  return (
    <div ref={ref}>
      {inView ? children : (placeholder || <div className="min-h-[160px]" aria-hidden="true" />)}
    </div>
  );
};

export default LazySection;
