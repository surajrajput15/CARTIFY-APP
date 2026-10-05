import { ShoppingCart, Heart, Check } from 'lucide-react';
import StarRating from './StarRating';
import { useCartActions } from '../context/cartContext';
import { useWishlist } from '../context/WishlistContext';
import { Link, useNavigate } from 'react-router-dom';
import { getStockStatus } from '../utils/stockStatus';
import { hasVariants, effectiveStock } from '../utils/variants';
import { resolveImageUrl, generateSrcSet, PLACEHOLDER_IMG } from '../utils/imageUrl';
import { formatPrice, truncate } from '../utils/format';
import { useActiveCampaigns } from '../hooks/useActiveCampaigns';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Card from './ui/Card';

const ProductCard = memo(({ product }) => {
  const { addToCart } = useCartActions(); // F-43: actions-only — memo stays intact on cart changes
  const navigate = useNavigate();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();
  const { bestForProduct } = useActiveCampaigns();
  const productId = String(product?._id || product?.id || '');
  const wishlisted = isWishlisted(productId);
  const productHasVariants = hasVariants(product);
  const hasSale = product?.salePrice != null && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price);
  const basePrice = hasSale ? Number(product.salePrice) : Number(product.price);
  const campaign = bestForProduct(product);
  const displayPrice = campaign ? basePrice - campaign.discount : basePrice;
  const originalPrice = hasSale ? Number(product.price) : (campaign ? Number(product.price) : null);
  const discountPercent = hasSale ? Math.round(((Number(product.price) - Number(product.salePrice)) / Number(product.price)) * 100) : null;
  const stock = getStockStatus(productHasVariants ? effectiveStock(product) : product.countInStock, product?.lowStockThreshold);

  // F-06: "Added" confirmation — the button flips to a check + the aria-live
  // status span announces it; state auto-clears so the card returns to normal.
  const [justAdded, setJustAdded] = useState(false);
  const addedTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(addedTimerRef.current), []);

  const handleWishlistToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlisted) {
      removeFromWishlist(product);
    } else {
      addToWishlist(product);
    }
  }, [wishlisted, addToWishlist, removeFromWishlist, product]);

  const handleAddToCart = useCallback(() => {
    if (productHasVariants) {
      navigate(`/product/${product._id}`);
      return;
    }
    addToCart(product);
    toast.success('Added to cart');
    setJustAdded(true);
    clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setJustAdded(false), 1500);
  }, [addToCart, product, productHasVariants, navigate]);

  const imageUrl = resolveImageUrl(product.image);
  const srcSet = generateSrcSet(product.image);
  const altText = product.title ? `${truncate(product.title, 60)} — ${product.category || 'product'}` : 'Product image';

  return (
    <Card className="rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border flex flex-col h-full">
      <Link
        to={`/product/${product._id}`}
        className="h-44 sm:h-56 overflow-hidden bg-gray-50 block cursor-pointer relative flex items-center justify-center border-b border-gray-100 group"
        aria-label={`View ${product.title}`}
      >
        {(stock || product.category || hasSale || campaign) && (
          <span className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
            {stock ? (
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm whitespace-nowrap ${stock.bgColor} ${stock.textColor}`}>
                {stock.label}
              </span>
            ) : <span />}
            {hasSale && (
              <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm whitespace-nowrap">
                {discountPercent}% OFF
              </span>
            )}
            {product.category && (
              <span className="bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm max-w-[160px] truncate">
                {product.category}
              </span>
            )}
            {campaign && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm whitespace-nowrap">
                ⚡ {campaign.campaign?.bannerText?.slice(0, 24) || 'On sale'}
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className={`absolute top-3 right-3 z-20 p-2.5 rounded-full shadow-md transition-all active:scale-90 min-w-[44px] min-h-[44px] inline-flex items-center justify-center ${
            wishlisted
              ? 'bg-red-50 text-red-500 border border-red-100'
              : 'bg-white text-gray-500 border border-gray-100 hover:text-red-500 hover:border-red-200'
          }`}
        >
          <Heart size={18} aria-hidden="true" className={wishlisted ? 'fill-current' : ''} />
        </button>
        <img
          src={imageUrl}
          srcSet={srcSet}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          alt={altText}
          width="300"
          height="300"
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
          className="max-h-full max-w-full object-contain p-4 motion-safe:group-hover:scale-105 transition-transform duration-500 ease-out"
        />
      </Link>

      <div className="p-3 sm:p-5 flex flex-col flex-grow">
        {product.brand && (
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
            {product.brand}
          </span>
        )}
        <Link to={`/product/${product._id}`}>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 line-clamp-2 mb-2 hover:text-teal-600 transition-colors leading-snug min-h-[2.5rem] sm:min-h-[3rem]">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
          <StarRating rating={product.rating?.rate} size={14} />
          <span className="text-xs text-gray-600 font-bold" aria-label={`Rating ${Number(product.rating?.rate) || 0} out of 5`}>
            {Number(product.rating?.rate) || 0}
          </span>
          <span className="text-gray-300 text-xs" aria-hidden="true">|</span>
          <span className="text-xs text-gray-600 font-medium">
            {Number(product.rating?.count) || 0
              ? `(${Number(product.rating?.count)} reviews)`
              : 'Not yet rated'}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="min-w-0">
            {originalPrice && originalPrice > displayPrice && (
              <span className="block text-xs text-gray-400 line-through truncate" aria-hidden="true">{formatPrice(originalPrice)}</span>
            )}
            <span className="text-lg sm:text-xl font-black text-gray-900 whitespace-nowrap">
              {formatPrice(displayPrice)}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={stock?.disabled}
            aria-label={stock?.disabled ? `${product.title} is out of stock` : productHasVariants ? `Choose options for ${product.title}` : justAdded ? `${product.title} added to cart` : `Add ${product.title} to cart`}
            title={productHasVariants && !stock?.disabled ? 'Choose size / colour' : undefined}
            className={`p-2.5 rounded-xl transition-all shadow-md hover:shadow-lg shadow-teal-100 hover:shadow-teal-200 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              stock?.disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                : justAdded
                  ? 'bg-green-600 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {justAdded ? <Check size={18} aria-hidden="true" /> : <ShoppingCart size={18} aria-hidden="true" />}
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {justAdded ? `${product.title} added to cart` : ''}
          </span>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
