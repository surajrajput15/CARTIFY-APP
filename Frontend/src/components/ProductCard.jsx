import { ShoppingCart, Star } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { Link } from 'react-router-dom';
import { getStockStatus } from '../utils/stockStatus';
import { resolveImageUrl, generateSrcSet } from '../utils/imageUrl';
import { memo, useCallback } from 'react';

const ProductCard = memo(({ product }) => {
  const { addToCart } = useCart();
  const stock = getStockStatus(product.countInStock);

  const handleAddToCart = useCallback(() => {
    addToCart(product);
  }, [addToCart, product]);

  const imageUrl = resolveImageUrl(product.image);
  const srcSet = generateSrcSet(product.image);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full group">
      
      <Link to={`/product/${product._id}`} className="h-56 overflow-hidden bg-gray-50 block cursor-pointer relative p-4 flex items-center justify-center border-b border-gray-50" style={{ aspectRatio: '1 / 1' }}>
        {stock && (
          <span className={`absolute top-3 left-3 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm ${stock.bgColor} ${stock.textColor}`}>
            {stock.label}
          </span>
        )}
        <span className="absolute top-3 right-3 bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm">
          {product.category}
        </span>
        <img 
          src={imageUrl}
          srcSet={srcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
        />
      </Link>
      
      <div className="p-5 flex flex-col flex-grow">
        <Link to={`/product/${product._id}`}>
          <h3 className="text-base font-semibold text-gray-800 line-clamp-2 mb-2 hover:text-teal-600 transition-colors leading-snug">
            {product.title}
          </h3>
        </Link>
        
        <div className="flex items-center space-x-1.5 mb-4">
          <div className="flex items-center text-yellow-400">
            <Star className="fill-current" size={14} aria-hidden="true" />
          </div>
          <span className="text-xs text-gray-600 font-bold" aria-label={`Rating ${product.rating?.rate || 0} out of 5`}>{product.rating?.rate || 0}</span>
          <span className="text-gray-300 text-xs" aria-hidden="true">|</span>
          <span className="text-xs text-gray-400">({product.rating?.count || 0} reviews)</span>
        </div>
        
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xl font-black text-gray-900">
            ₹{product.price}
          </span>
          <button 
            onClick={handleAddToCart}
            disabled={stock?.disabled}
            className={`p-2.5 rounded-xl transition-all shadow-md hover:shadow-lg shadow-teal-100 hover:shadow-teal-200 active:scale-95 ${
              stock?.disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
            aria-label={stock?.disabled ? `${product.title} is out of stock` : `Add ${product.title} to cart`}
          >
            <ShoppingCart size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
