import { Edit3, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { getStockStatus } from '../../utils/stockStatus';
import { resolveImageUrl, PLACEHOLDER_IMG } from '../../utils/imageUrl';
import { formatPrice, formatNumber } from '../../utils/format';
import StockBadge from '../StockBadge';
import Card from '../ui/Card';

const ProductTable = ({ products, onEdit, onDelete, onToggleArchive }) => (
  <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
    <div className="overflow-x-auto" role="region" aria-label="Products table (scroll horizontally)" tabIndex={0}>
      <table className="w-full text-sm min-w-[860px]">
        <thead className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="text-left p-3.5 font-bold">Image</th>
            <th className="text-left p-3.5 font-bold">Title & SKU</th>
            <th className="text-left p-3.5 font-bold">Category</th>
            <th className="text-left p-3.5 font-bold">Status</th>
            <th className="text-left p-3.5 font-bold">Stock</th>
            <th className="text-left p-3.5 font-bold">Price</th>
            <th className="text-left p-3.5 font-bold">Rating</th>
            <th className="text-center p-3.5 font-bold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => {
            const stock = getStockStatus(p.countInStock);
            const isArchived = p.status === 'archived';
            return (
              <tr key={p._id} className={`hover:bg-gray-50/70 transition-colors ${isArchived ? 'bg-gray-50/40 opacity-75' : ''}`}>
                <td className="p-3.5">
                  <img
                    src={p.image ? resolveImageUrl(p.image) : PLACEHOLDER_IMG}
                    alt={p.title || 'Product'}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    className="h-11 w-11 object-contain rounded-lg bg-gray-50 border border-gray-100"
                  />
                </td>
                <td className="p-3.5 font-medium text-gray-800 max-w-xs">
                  <div className="font-bold text-gray-900 truncate" title={p.title}>{p.title}</div>
                  <div className="text-[11px] font-mono text-gray-400">
                    {p.sku ? `SKU: ${p.sku}` : `ID: ${String(p._id).slice(-6).toUpperCase()}`}
                  </div>
                </td>
                <td className="p-3.5 capitalize text-gray-600 whitespace-nowrap text-xs">{p.category}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isArchived
                      ? 'bg-amber-100 text-amber-800'
                      : p.status === 'draft'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {p.status || 'active'}
                  </span>
                </td>
                <td className="p-3.5">
                  {stock ? <StockBadge countInStock={p.countInStock} size="sm" /> : <span className="text-gray-500">&mdash;</span>}
                </td>
                <td className="p-3.5 font-bold text-gray-900 whitespace-nowrap text-xs">{formatPrice(p.price)}</td>
                <td className="p-3.5 text-gray-600 whitespace-nowrap text-xs">
                  {Number(p.rating?.rate) || 0} ({formatNumber(p.rating?.count || 0)})
                </td>
                <td className="p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="text-teal-600 hover:text-teal-800 p-1.5 hover:bg-teal-50 rounded-lg transition-colors min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                      aria-label={`Edit ${p.title}`}
                      title="Edit product specification"
                    >
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                    {onToggleArchive && (
                      <button
                        type="button"
                        onClick={() => onToggleArchive(p)}
                        className={`p-1.5 rounded-lg transition-colors min-w-[36px] min-h-[36px] inline-flex items-center justify-center ${
                          isArchived
                            ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                        }`}
                        aria-label={isArchived ? `Restore ${p.title}` : `Archive ${p.title}`}
                        title={isArchived ? 'Reactivate archived product' : 'Safely archive product'}
                      >
                        {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(p._id)}
                      className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                      aria-label={`Delete or archive ${p.title}`}
                      title="Delete or soft-archive"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
);

export default ProductTable;
