import { Search, Plus } from 'lucide-react';

const AdminFilterBar = ({
  searchTerm,
  onSearchChange,
  filterCategory,
  onCategoryChange,
  categories,
  productsCount,
  filteredCount,
  hasFilters,
  onAddProduct
}) => (
  <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" role="search" aria-label="Filter products">
    <p className="text-gray-600 font-medium whitespace-nowrap">
      {hasFilters ? (
        <>Showing {filteredCount} of {productsCount} products</>
      ) : (
        <>{productsCount} products</>
      )}
    </p>
    <div className="flex gap-3 flex-1 sm:flex-none justify-end">
      <div className="relative flex-1 sm:flex-initial">
        <label htmlFor="search-input" className="sr-only">Search products</label>
        <Search className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          id="search-input"
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 w-full sm:w-52"
        />
      </div>
      <select
        value={filterCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Filter by category"
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500"
      >
        <option value="">All Categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button onClick={onAddProduct} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-sm">
        <Plus size={18} aria-hidden="true" /> Add Product
      </button>
    </div>
  </div>
);

export default AdminFilterBar;
