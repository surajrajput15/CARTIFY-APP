import { ArrowLeft, Package } from 'lucide-react';

const AdminHeader = ({ onBack, onSeed, onClearAll }) => (
  <div className="flex items-center justify-between mb-8">
    <div>
      <button onClick={onBack} className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-2">
        <ArrowLeft size={16} className="mr-1" /> Back to Store
      </button>
      <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
        <Package className="text-teal-600" size={32} /> Admin Dashboard
      </h1>
    </div>
    <div className="flex gap-3">
      <button onClick={onSeed} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">
        Seed 20 Products
      </button>
      <button onClick={onClearAll} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors">
        Clear All
      </button>
    </div>
  </div>
);

export default AdminHeader;
