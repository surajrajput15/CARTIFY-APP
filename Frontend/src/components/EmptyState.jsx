import { SearchEmptyIllustration } from './illustrations/EmptyStateIllustrations';

const EmptyState = ({ message, onClearFilters }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-12 sm:py-16 px-4 text-center">
    <SearchEmptyIllustration className="mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-3" />
    <h3 className="text-base sm:text-lg font-bold text-gray-600 mb-1">No products found</h3>
    <p className="text-sm text-gray-400 max-w-xs mx-auto">{message}</p>
    {onClearFilters && (
      <button
        onClick={onClearFilters}
        className="mt-5 inline-flex items-center px-5 py-2.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors min-h-[44px]"
      >
        Clear all filters
      </button>
    )}
  </div>
);

export default EmptyState;