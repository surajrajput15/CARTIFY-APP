// Reusable skeleton loader components for loading states

export const SkeletonCard = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full animate-pulse">
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

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="bg-gray-50 border-b border-gray-100 p-4">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-20" />
        ))}
      </div>
    </div>
    <div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4 p-4 border-b border-gray-50 animate-pulse">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div key={colIdx} className="h-4 bg-gray-200 rounded w-20" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`h-4 bg-gray-200 rounded animate-pulse ${
          i === lines - 1 ? 'w-2/3' : 'w-full'
        }`}
      />
    ))}
  </div>
);

export const SkeletonImage = ({ className = 'h-48 w-full' }) => (
  <div className={`${className} bg-gray-200 animate-pulse rounded`} />
);

export const SkeletonButton = ({ className = 'h-10 w-24' }) => (
  <div className={`${className} bg-gray-200 rounded-lg animate-pulse`} />
);