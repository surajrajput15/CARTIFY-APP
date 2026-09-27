import { Edit3, Trash2 } from 'lucide-react';
import { getStockStatus } from '../../utils/stockStatus';
import { resolveImageUrl, PLACEHOLDER_IMG } from '../../utils/imageUrl';
import { formatPrice, formatNumber } from '../../utils/format';
import StockBadge from '../StockBadge';
import Card from '../ui/Card';

const ProductTable = ({ products, onEdit, onDelete }) => (
  <Card className="rounded-2xl border overflow-hidden">
    <div className="overflow-x-auto" role="region" aria-label="Products table (scroll horizontally)" tabIndex={0}>
      <table className="w-full text-sm min-w-[800px]">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left p-4 font-bold text-gray-600">Image</th>
            <th className="text-left p-4 font-bold text-gray-600">Title</th>
            <th className="text-left p-4 font-bold text-gray-600">Category</th>
            <th className="text-left p-4 font-bold text-gray-600">Stock</th>
            <th className="text-left p-4 font-bold text-gray-600">Price</th>
            <th className="text-left p-4 font-bold text-gray-600">Rating</th>
            <th className="text-center p-4 font-bold text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map((p) => {
            const stock = getStockStatus(p.countInStock);
            return (
              <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <img
                    src={p.image ? resolveImageUrl(p.image) : PLACEHOLDER_IMG}
                    alt={p.title || 'Product'}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    className="h-12 w-12 object-contain rounded-lg bg-gray-50"
                  />
                </td>
                <td className="p-4 font-medium text-gray-800 max-w-xs">
                  <div className="truncate" title={p.title}>{p.title}</div>
                </td>
                <td className="p-4 capitalize text-gray-600 whitespace-nowrap">{p.category}</td>
                <td className="p-4">
                  {stock ? <StockBadge countInStock={p.countInStock} size="sm" /> : <span className="text-gray-500">&mdash;</span>}
                </td>
                <td className="p-4 font-bold text-gray-900 whitespace-nowrap">{formatPrice(p.price)}</td>
                <td className="p-4 text-gray-600 whitespace-nowrap">
                  {Number(p.rating?.rate) || 0} ({formatNumber(p.rating?.count || 0)})
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(p)}
                      className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                      aria-label={`Edit ${p.title}`}
                    >
                      <Edit3 size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onDelete(p._id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                      aria-label={`Delete ${p.title}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
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
