import Card from './ui/Card';
// Reusable skeleton loader components for loading states
//
// F-32: cards carry NO role="status" — the surrounding list/grid owns a single
// status region so screen readers announce "Loading products" once, not 4-8 times.

export const SkeletonCard = () => (
  <Card aria-hidden="true" className="rounded-2xl border overflow-hidden flex flex-col h-full animate-pulse">
    {/* F-21: fixed heights only (mirrors ProductCard) — h-56 + aspect-ratio conflicted */}
    <div className="h-44 sm:h-56 bg-gray-200" />
    <div className="p-5 space-y-3 flex flex-col flex-grow">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-auto" />
      <div className="flex items-center justify-between pt-2">
        <div className="h-6 bg-gray-200 rounded w-16" />
        <div className="h-10 w-10 bg-gray-200 rounded-xl" />
      </div>
    </div>
  </Card>
);

export const SkeletonList = ({ count = 8 }) => (
  <div
    role="status"
    aria-label="Loading products"
    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);