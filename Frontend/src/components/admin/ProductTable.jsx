import { Edit3, Trash2 } from 'lucide-react';
import { getStockStatus } from '../../utils/stockStatus';
import StockBadge from '../StockBadge';

const ProductTable = ({ products, onEdit, onDelete }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
                  <img src={p.image} alt={p.title} loading="lazy" className="h-12 w-12 object-contain rounded-lg bg-gray-50" />
                </td>
                <td className="p-4 font-medium text-gray-800 max-w-xs truncate">{p.title}</td>
                <td className="p-4 capitalize text-gray-600">{p.category}</td>
                <td className="p-4">
                  {stock ? <StockBadge countInStock={p.countInStock} size="sm" /> : <span className="text-gray-400">&mdash;</span>}
                </td>
                <td className="p-4 font-bold text-gray-900">₹{p.price}</td>
                <td className="p-4 text-gray-600">{p.rating?.rate} ({p.rating?.count})</td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEdit(p)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit ${p.title}`}>
                      <Edit3 size={18} aria-hidden="true" />
                    </button>
                    <button onClick={() => onDelete(p._id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Delete ${p.title}`}>
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
  </div>
);

export default ProductTable;
