import { Search } from 'lucide-react';

const EmptyState = ({ message, onClearFilters }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-20 px-4 text-center">
    <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-bold text-gray-600 mb-1">No products found</h3>
    <p className="text-sm text-gray-400 max-w-xs mx-auto">{message}</p>
    <button
      onClick={onClearFilters}
      className="mt-6 text-sm font-medium text-teal-600 hover:text-teal-700 underline underline-offset-2"
    >
      Clear all filters
    </button>
  </div>
);

export default EmptyState;
