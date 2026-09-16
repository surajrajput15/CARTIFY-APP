// Reusable skeleton loader components for loading states

export const SkeletonCard = () => (
  <div role="status" aria-label="Loading product" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full animate-pulse">
    <div className="h-56 bg-gray-200" style={{ aspectRatio: '1 / 1' }} />
    <div className="p-5 space-y-3 flex flex-col flex-grow">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-auto" />
      <div className="flex items-center justify-between pt-2">
        <div className="h-6 bg-gray-200 rounded w-16" />
        <div className="h-10 w-10 bg-gray-200 rounded-xl" />
      </div>
    </div>
  </div>
);

export const SkeletonList = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);