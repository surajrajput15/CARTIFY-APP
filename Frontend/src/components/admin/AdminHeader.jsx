import { ArrowLeft, Package, Database, Trash2 } from 'lucide-react';

const AdminHeader = ({ onBack, onSeed, onClearAll, showDevActions = false }) => {
    const isProd = import.meta.env.PROD || import.meta.env.MODE === 'production';

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <button
                    onClick={onBack}
                    className="flex items-center text-xs font-bold text-teal-600 hover:text-teal-700 mb-1 min-h-[36px] px-2 -ml-2 rounded-lg hover:bg-teal-50 transition-colors"
                >
                    <ArrowLeft size={14} className="mr-1" aria-hidden="true" /> Back to Store
                </button>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
                    <Package className="text-teal-600 flex-shrink-0" size={24} aria-hidden="true" /> Product Catalog Manager
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage SKU master data, pricing, inventory thresholds, and catalog visibility</p>
            </div>
            {!isProd && showDevActions && (
                <div className="flex flex-wrap gap-2">
                    {onSeed && (
                        <button
                            onClick={onSeed}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold text-xs transition-colors min-h-[38px]"
                        >
                            <Database size={14} aria-hidden="true" /> Seed Products
                        </button>
                    )}
                    {onClearAll && (
                        <button
                            onClick={onClearAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold text-xs transition-colors min-h-[38px]"
                        >
                            <Trash2 size={14} aria-hidden="true" /> Clear DB
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminHeader;
