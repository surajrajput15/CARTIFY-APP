import { ShoppingCart, Star } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { Link } from 'react-router-dom';
import { getStockStatus } from '../utils/stockStatus';
import { resolveImageUrl, generateSrcSet } from '../utils/imageUrl';
import { formatPrice, truncate } from '../utils/format';
import { memo, useCallback } from 'react';

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

const ProductCard = memo(({ product }) => {
  const { addToCart } = useCart();
  const stock = getStockStatus(product.countInStock);

  const handleAddToCart = useCallback(() => {
    addToCart(product);
  }, [addToCart, product]);

  const imageUrl = resolveImageUrl(product.image);
  const srcSet = generateSrcSet(product.image);
  const altText = product.title ? `${truncate(product.title, 60)} — ${product.category || 'product'}` : 'Product image';

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full group">

      <Link
        to={`/product/${product._id}`}
        className="h-56 overflow-hidden bg-gray-50 block cursor-pointer relative p-4 flex items-center justify-center border-b border-gray-50"
        style={{ aspectRatio: '1 / 1' }}
        aria-label={`View ${product.title}`}
      >
        {stock && (
          <span className={`absolute top-3 left-3 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm ${stock.bgColor} ${stock.textColor}`}>
            {stock.label}
          </span>
        )}
        {product.category && (
          <span className="absolute top-3 right-3 bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 shadow-sm max-w-[60%] truncate">
            {product.category}
          </span>
        )}
        <img
          src={imageUrl}
          srcSet={srcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          alt={altText}
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
        />
      </Link>

      <div className="p-5 flex flex-col flex-grow">
        <Link to={`/product/${product._id}`}>
          <h3 className="text-base font-semibold text-gray-800 line-clamp-2 mb-2 hover:text-teal-600 transition-colors leading-snug min-h-[3rem]">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-center space-x-1.5 mb-4">
          <div className="flex items-center text-yellow-400">
            <Star className="fill-current" size={14} aria-hidden="true" />
          </div>
          <span className="text-xs text-gray-600 font-bold" aria-label={`Rating ${Number(product.rating?.rate) || 0} out of 5`}>
            {Number(product.rating?.rate) || 0}
          </span>
          <span className="text-gray-300 text-xs" aria-hidden="true">|</span>
          <span className="text-xs text-gray-400">({Number(product.rating?.count) || 0} reviews)</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 gap-2">
          <span className="text-xl font-black text-gray-900">
            {formatPrice(product.price)}
          </span>
          <button
            onClick={handleAddToCart}
            disabled={stock?.disabled}
            aria-label={stock?.disabled ? `${product.title} is out of stock` : `Add ${product.title} to cart`}
            className={`p-2.5 rounded-xl transition-all shadow-md hover:shadow-lg shadow-teal-100 hover:shadow-teal-200 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              stock?.disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
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
