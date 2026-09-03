import { memo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Edit3, Trash2 } from 'lucide-react';
import { getStockStatus } from '../../utils/stockStatus';
import { resolveImageUrl, generateSrcSet } from '../../utils/imageUrl';
import StockBadge from '../StockBadge';

const ROW_HEIGHT = 72;
const MIN_TABLE_HEIGHT = 400;

// Single row component - memoized to prevent re-renders
const ProductRow = memo(({ index, style, data }) => {
  const { products, onEdit, onDelete } = data;
  const product = products[index];
  if (!product) return null;

  const stock = getStockStatus(product.countInStock);
  const imageUrl = resolveImageUrl(product.image);
  const srcSet = generateSrcSet(product.image);

  const handleEdit = useCallback(() => onEdit(product), [onEdit, product]);
  const handleDelete = useCallback(() => onDelete(product._id), [onDelete, product._id]);

  return (
    <div
      style={style}
      className="flex items-center border-b border-gray-50 hover:bg-gray-50 transition-colors px-4"
    >
      <div className="w-16 flex-shrink-0">
        <img
          src={imageUrl}
          srcSet={srcSet}
          sizes="48px"
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="h-12 w-12 object-contain rounded-lg bg-gray-50"
        />
      </div>
      <div className="flex-1 min-w-0 px-4 font-medium text-gray-800 truncate">
        {product.title}
      </div>
      <div className="w-32 px-4 capitalize text-gray-600 truncate">
        {product.category}
      </div>
      <div className="w-24 px-4">
        {stock ? <StockBadge countInStock={product.countInStock} size="sm" /> : <span className="text-gray-400">&mdash;</span>}
      </div>
      <div className="w-24 px-4 font-bold text-gray-900">
        ₹{product.price}
      </div>
      <div className="w-28 px-4 text-gray-600">
        {product.rating?.rate} ({product.rating?.count})
      </div>
      <div className="w-24 px-4 flex items-center justify-center gap-1">
        <button
          onClick={handleEdit}
          className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label={`Edit ${product.title}`}
        >
          <Edit3 size={18} aria-hidden="true" />
        </button>
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
          aria-label={`Delete ${product.title}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

ProductRow.displayName = 'ProductRow';

// Header component
const ProductHeader = () => (
  <div className="flex items-center bg-gray-50 border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-600">
    <div className="w-16 flex-shrink-0">Image</div>
    <div className="flex-1 px-4">Title</div>
    <div className="w-32 px-4">Category</div>
    <div className="w-24 px-4">Stock</div>
    <div className="w-24 px-4">Price</div>
    <div className="w-28 px-4">Rating</div>
    <div className="w-24 px-4 text-center">Action</div>
  </div>
);

const VirtualizedProductTable = ({ products, onEdit, onDelete }) => {
  const itemData = { products, onEdit, onDelete };
  const tableHeight = Math.min(
    Math.max(MIN_TABLE_HEIGHT, products.length * ROW_HEIGHT + 50),
    600
  );

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
        No products found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <ProductHeader />
      <List
        height={tableHeight}
        itemCount={products.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
        width="100%"
        overscanCount={5}
      >
        {ProductRow}
      </List>
    </div>
  );
};

export default VirtualizedProductTable;