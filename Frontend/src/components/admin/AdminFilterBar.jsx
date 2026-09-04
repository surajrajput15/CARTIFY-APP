import { Search, Plus, Filter } from 'lucide-react';

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
  <div className="mb-6 flex flex-col gap-4" role="search" aria-label="Filter products">
    <p className="text-gray-600 font-medium text-sm">
      {hasFilters ? (
        <>Showing <span className="font-bold text-gray-800">{filteredCount}</span> of <span className="font-bold text-gray-800">{productsCount}</span> products</>
      ) : (
        <><span className="font-bold text-gray-800">{productsCount}</span> products</>
      )}
    </p>

    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
      <div className="relative flex-1 sm:max-w-xs">
        <label htmlFor="admin-search-input" className="sr-only">Search products</label>
        <Search className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          id="admin-search-input"
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 w-full min-h-[44px]"
        />
      </div>
      <div className="relative flex-1 sm:flex-initial sm:min-w-[160px]">
        <label htmlFor="admin-category-filter" className="sr-only">Filter by category</label>
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
        <select
          id="admin-category-filter"
          value={filterCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Filter by category"
          className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 w-full min-h-[44px] appearance-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button
        onClick={onAddProduct}
        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-sm min-h-[44px]"
      >
        <Plus size={18} aria-hidden="true" /> Add Product
      </button>
    </div>
  </div>
);

export default AdminFilterBar;
