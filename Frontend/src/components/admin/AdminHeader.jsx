import { ArrowLeft, Package, Database, Trash2 } from 'lucide-react';

const AdminHeader = ({ onBack, onSeed, onClearAll }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
    <div>
      <button
        onClick={onBack}
        className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-2 min-h-[44px] px-2 -ml-2 rounded-lg hover:bg-teal-50 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" aria-hidden="true" /> Back to Store
      </button>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-3">
        <Package className="text-teal-600 flex-shrink-0" size={28} /> Admin Dashboard
      </h1>
    </div>
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <button
        onClick={onSeed}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        <Database size={16} aria-hidden="true" /> Seed Products
      </button>
      <button
        onClick={onClearAll}
        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors min-h-[44px]"
      >
        <Trash2 size={16} aria-hidden="true" /> Clear All
      </button>
    </div>
  </div>
);

export default AdminHeader;
