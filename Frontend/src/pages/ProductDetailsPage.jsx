import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/cartContext';
import { ShoppingCart, ArrowLeft, RefreshCw, Minus, Plus, Lock, Heart } from 'lucide-react';
import { getStockStatus } from '../utils/stockStatus';
import { resolveImageUrl } from '../utils/imageUrl';
import { formatPrice, formatNumber } from '../utils/format';
import { getShippingMessage } from '../utils/constants';
import StockBadge from '../components/StockBadge';
import StarRating from '../components/StarRating';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorIllustration } from '../components/illustrations/EmptyStateIllustrations';
import toast from 'react-hot-toast';
import { logError } from '../utils/logger';
import { fetchProductById, fetchProducts } from '../services/productsApi';
import ProductCard from '../components/ProductCard';
import { useWishlist } from '../context/WishlistContext';
import { hasVariants, getVariantOptions, findVariant, variantPrice, isOptionAvailable, buildVariantKey, variantLabel } from '../utils/variants';
import { useAuth } from '../context/authContext';
import { recordRecentView } from '../utils/recentlyViewed';

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState(null);
  const [justAdded, setJustAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  // Guards against out-of-order responses when the user jumps between
  // products faster than the API replies — only the latest request applies.
  const requestIdRef = useRef(0);
  const { addToCart } = useCart();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();
  const { user } = useAuth();
  const [wishlisted, setWishlisted] = useState(false);

  const loading = product === null;
  const relatedLoading = relatedProducts === null;

  const fetchProduct = useCallback(() => {
    const myRequest = ++requestIdRef.current;
    fetchProductById(id)
      .then((response) => {
        if (requestIdRef.current !== myRequest) return;
        setProduct(response.data);
        recordRecentView(response.data, user?.id);
        setError(null);
      })
      .catch((err) => {
        if (requestIdRef.current !== myRequest) return;
        logError('Error fetching product:', err);
        const message = err.response?.data?.message || 'Failed to load product details';
        setError(message);
        toast.error(message);
      });
  }, [id]);

  // Per-product UI reset when navigating between products (route-driven, so
  // there is no local handler to hang it on) — one-shot, intentional.
  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setJustAdded(false);
    setQuantity(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setSelectedSize(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setSelectedColor(null);
    fetchProduct();
  }, [fetchProduct]);

  const fetchRelated = useCallback((category, excludeId) => {
    const myRequest = ++requestIdRef.current;
    fetchProducts({ category, limit: 5 })
      .then((response) => {
        if (requestIdRef.current !== myRequest) return;
        const data = Array.isArray(response.data) ? response.data : response.data.products || [];
        setRelatedProducts(data.filter((p) => p._id !== excludeId).slice(0, 4));
      })
      .catch(() => {
        if (requestIdRef.current !== myRequest) return;
        setRelatedProducts([]);
      });
  }, []);

  // Wishlist + related sync on route/product change (one-shot UI reset).
  useEffect(() => {
    if (!product) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setWishlisted(isWishlisted(product._id));
    fetchRelated(product.category, product._id);
  }, [product, fetchRelated, isWishlisted]);

  const handleGoBack = () => {
    const hasHistory = window.history.length > 1;
    const hasReferrer = document.referrer && document.referrer.startsWith(window.location.origin);
    if (hasHistory || hasReferrer) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  if (error) {
    return (
      <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
        <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg min-h-[44px] px-2" aria-label="Go back to previous page">
          <ArrowLeft size={20} className="mr-2" />
          Back to Products
        </button>
        <div className="min-h-[50vh] flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
          <ErrorIllustration className="w-24 h-24 sm:w-32 sm:h-32 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Couldn't load product</h2>
          <p className="text-gray-500 mb-8 text-center max-w-md">{error}</p>
          <button
            onClick={fetchProduct}
            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md min-h-[44px]"
          >
            <RefreshCw size={20} />
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row animate-pulse">
          <div className="md:w-1/2 p-8 bg-gray-50 flex justify-center items-center">
            <div className="h-[300px] sm:h-[400px] w-full bg-gray-200 rounded-xl"></div>
          </div>
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center space-y-4">
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
            <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
            <div className="h-6 w-32 bg-gray-200 rounded"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded"></div>
              <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
              <div className="h-4 w-4/6 bg-gray-200 rounded"></div>
            </div>
            <div className="h-12 w-40 bg-gray-200 rounded mt-4"></div>
            <div className="h-14 w-full bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  const productHasVariants = hasVariants(product);
  const { sizes, colors } = getVariantOptions(product);
  const requiresSize = sizes.length > 0;
  const requiresColor = colors.length > 0;
  const selectedVariant = productHasVariants ? findVariant(product, selectedSize, selectedColor) : null;
  const selectionComplete = (!requiresSize || selectedSize) && (!requiresColor || selectedColor);
  const needsSelection = productHasVariants && !selectionComplete;
  const activePrice = selectedVariant ? variantPrice(product, selectedVariant) : product.price;
  const activeStock = productHasVariants
    ? (selectedVariant ? (Number(selectedVariant.stock) || 0) : 0)
    : product.countInStock;
  const stockStatus = getStockStatus(activeStock);
  const addDisabled = needsSelection || (productHasVariants ? activeStock <= 0 : stockStatus?.disabled);
  const maxQty = activeStock > 0 ? activeStock : 20;
  const decreaseQty = () => setQuantity((q) => Math.max(1, q - 1));
  const increaseQty = () => setQuantity((q) => Math.min(maxQty, q + 1));

  const handleAddToCart = () => {
    if (needsSelection) {
      toast.error('Please choose a size and colour');
      return;
    }
    const variantKey = selectedVariant ? buildVariantKey(selectedVariant) : null;
    const item = selectedVariant
      ? {
          ...product,
          price: activePrice,
          countInStock: activeStock,
          variantKey,
          variantSize: selectedVariant.size || null,
          variantColor: selectedVariant.color || null
        }
      : product;
    addToCart(item, quantity);
    setJustAdded(true);
    toast.success(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`);
  };

  const handleWishlistToggle = () => {
    if (!product) return;
    if (wishlisted) {
      removeFromWishlist(product);
      setWishlisted(false);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(product);
      setWishlisted(true);
      toast.success('Saved to wishlist');
    }
  };

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg min-h-[44px] px-2" aria-label="Go back to previous page">
        <ArrowLeft size={20} className="mr-2" />
        Back to Products
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-1/2 p-6 sm:p-8 bg-gray-50 flex justify-center items-center min-h-[300px]">
          <img
            src={resolveImageUrl(product.image)}
            alt={product.title || 'Product image'}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
            className="max-h-[300px] sm:max-h-[400px] max-w-full object-contain hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="md:w-1/2 p-6 sm:p-8 md:p-12 flex flex-col justify-center">
          {product.category && (
            <span className="text-sm font-semibold text-teal-600 tracking-wider uppercase mb-2">
              {product.category}
            </span>
          )}

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {product.title}
          </h1>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
              <StarRating rating={product.rating?.rate} size={16} />
              <span className="font-bold text-gray-700">{Number(product.rating?.rate) || 0}</span>
            </div>
            <span className="text-sm text-gray-500">
              {Number(product.rating?.count) || 0
                ? `Based on ${formatNumber(product.rating.count)} reviews`
                : 'No reviews yet'}
            </span>
          </div>

          <p className="text-gray-600 text-base sm:text-lg mb-8 leading-relaxed">
            {product.description}
          </p>

          <div className="mt-auto flex items-center gap-4 pb-4 border-b border-gray-100 mb-6">
            <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              {formatPrice(activePrice)}
            </span>
          </div>

          {productHasVariants && (
            <div className="space-y-4 mb-5">
              {requiresSize && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Size</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Select size">
                    {sizes.map((size) => {
                      const available = isOptionAvailable(product, { size, color: selectedColor });
                      const active = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(active ? null : size)}
                          disabled={!available}
                          aria-pressed={active}
                          className={`min-w-[48px] px-3 py-2 rounded-lg border-2 text-sm font-bold transition-colors min-h-[44px] ${
                            active
                              ? 'border-teal-600 bg-teal-50 text-teal-700'
                              : available
                                ? 'border-gray-200 text-gray-700 hover:border-teal-300'
                                : 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {requiresColor && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Colour</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Select colour">
                    {colors.map((color) => {
                      const available = isOptionAvailable(product, { size: selectedSize, color });
                      const active = selectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(active ? null : color)}
                          disabled={!available}
                          aria-pressed={active}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-bold transition-colors min-h-[44px] ${
                            active
                              ? 'border-teal-600 bg-teal-50 text-teal-700'
                              : available
                                ? 'border-gray-200 text-gray-700 hover:border-teal-300'
                                : 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
                          }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedVariant && (
                <p className="text-xs text-gray-500">
                  Selected: <span className="font-semibold text-gray-700">{variantLabel(selectedVariant.size, selectedVariant.color)}</span>
                  {selectedVariant.sku ? <span className="text-gray-400"> · SKU {selectedVariant.sku}</span> : null}
                </p>
              )}
            </div>
          )}

          {!needsSelection && <StockBadge countInStock={activeStock} className="mb-4" />}
          {needsSelection && (
            <p className="text-sm text-amber-600 font-medium mb-4">Select {requiresSize ? 'a size' : ''}{requiresSize && requiresColor ? ' and ' : ''}{requiresColor ? 'a colour' : ''} to see availability.</p>
          )}

          {!addDisabled && (
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-bold text-gray-700">Quantity:</span>
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                <button
                  onClick={decreaseQty}
                  disabled={quantity <= 1}
                  className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Decrease quantity"
                >
                  <Minus size={18} aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-bold text-gray-900 text-lg" aria-live="polite" aria-label={`Quantity ${quantity}`}>
                  {quantity}
                </span>
                <button
                  onClick={increaseQty}
                  disabled={quantity >= maxQty}
                  className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Increase quantity"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {maxQty} available
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWishlistToggle}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
              className={`p-3.5 rounded-xl border-2 font-bold transition-colors min-w-[52px] min-h-[52px] inline-flex items-center justify-center ${
                wishlisted ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
              }`}
            >
              <Heart size={22} aria-hidden="true" className={wishlisted ? "fill-current" : ""} />
            </button>
            <button
            onClick={handleAddToCart}
            disabled={addDisabled}
            className={`flex-1 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-colors shadow-lg flex justify-center items-center gap-2 min-h-[52px] ${
              addDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 shadow-gray-200'
                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-200'
            }`}
          >
            <ShoppingCart size={22} aria-hidden="true" />
            {needsSelection
              ? 'Select Options'
              : addDisabled
                ? 'Out of Stock'
                : <span className="inline-flex items-center gap-2">Add to Cart · {formatPrice(activePrice * quantity)}</span>}
          </button>
          </div>

          {justAdded && !addDisabled && (
            <Link
              to="/cart"
              className="w-full mt-3 py-3 rounded-xl font-bold text-base text-center border-2 border-teal-600 text-teal-700 hover:bg-teal-50 transition-colors min-h-[52px] inline-flex justify-center items-center"
            >
              View Cart & Checkout
            </Link>
          )}

          <p className="text-xs text-center text-gray-500 mt-3 flex items-center justify-center gap-1">
            <Lock size={12} aria-hidden="true" /> Secure checkout · {getShippingMessage(activePrice).text} shipping
          </p>
        </div>
      </div>

      {relatedProducts?.length > 0 && (
        <section className="mt-12 sm:mt-14" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 flex items-center gap-3">
            <span className="w-1 h-7 bg-teal-500 rounded-full" aria-hidden="true" />
            Related Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp._id} product={rp} />
            ))}
          </div>
        </section>
      )}

      {relatedLoading && (
        <section className="mt-12 sm:mt-14" aria-labelledby="related-loading-heading">
          <h2 id="related-loading-heading" className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 flex items-center gap-3">
            <span className="w-1 h-7 bg-teal-500 rounded-full" aria-hidden="true" />
            Related Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
          </div>
        </section>
      )}
    </main>
  );
};

export default ProductDetailsPage;