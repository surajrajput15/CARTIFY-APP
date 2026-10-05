import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/cartContext';
import { ShoppingCart, ArrowLeft, RefreshCw, Minus, Plus, Lock, Heart, Star, MessageSquare, CheckCircle2 } from 'lucide-react';
import { getStockStatus } from '../utils/stockStatus';
import { resolveImageUrl, PLACEHOLDER_IMG } from '../utils/imageUrl';
import { formatPrice, formatNumber, formatDate } from '../utils/format';
import { getShippingMessage } from '../utils/constants';
import StockBadge from '../components/StockBadge';
import StarRating from '../components/StarRating';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorIllustration } from '../components/illustrations/EmptyStateIllustrations';
import toast from 'react-hot-toast';
import { logError } from '../utils/logger';
import { fetchProductById, fetchProducts } from '../services/productsApi';
import { fetchProductReviews, createReview } from '../services/reviewApi';
import ProductCard from '../components/ProductCard';
import { useWishlist } from '../context/WishlistContext';
import { hasVariants, getVariantOptions, findVariant, variantPrice, isOptionAvailable, buildVariantKey, variantLabel } from '../utils/variants';
import { useAuth } from '../context/authContext';
import { recordRecentView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { usePageTitle } from '../hooks/usePageTitle';
import useSeo from '../hooks/useSeo';

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

  // Customer Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loading = product === null;
  const relatedLoading = relatedProducts === null;

  // Title follows the loaded product; falls back while fetching or on error.
  useSeo({
    title: product?.title || 'Product Details',
    description: product?.description
      ? `${product.description.slice(0, 150)}... Buy now on Cartify with free delivery.`
      : 'Explore product specifications, prices, and reviews on Cartify.',
    canonical: `/product/${id}`,
    image: product?.image ? resolveImageUrl(product.image) : undefined,
    schema: product
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Product',
              name: product.title,
              image: resolveImageUrl(product.image),
              description: product.description,
              category: product.category,
              offers: {
                '@type': 'Offer',
                price: product.price,
                priceCurrency: 'INR',
                availability:
                  (product.countInStock ?? 1) > 0
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                seller: {
                  '@type': 'Organization',
                  name: 'Cartify',
                },
              },
              ...(product.rating?.rate
                ? {
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: product.rating.rate,
                      reviewCount: product.rating.count || 1,
                    },
                  }
                : {}),
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: 'https://cartify-hub.vercel.app/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: product.category
                    ? product.category.charAt(0).toUpperCase() + product.category.slice(1)
                    : 'Products',
                  item: `https://cartify-hub.vercel.app/?category=${encodeURIComponent(product.category || 'all')}`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: product.title,
                  item: `https://cartify-hub.vercel.app/product/${id}`,
                },
              ],
            },
          ],
        }
      : null,
  });

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
  }, [id, user?.id]);

  const fetchReviews = useCallback((productId) => {
    if (!productId) return;
    setReviewsLoading(true);
    fetchProductReviews(productId)
      .then((res) => {
        setReviews(res.data?.reviews || []);
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => {
        setReviewsLoading(false);
      });
  }, []);

  // Per-product UI reset when navigating between products (route-driven, so
  // there is no local handler to hang it on) — one-shot, intentional.
  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setJustAdded(false);
    setQuantity(1);
    setSelectedSize(null);
    setSelectedColor(null);
    setShowReviewForm(false);
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(5);
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

  // Wishlist + related + reviews sync on route/product change.
  useEffect(() => {
    if (!product) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on product id change
    setWishlisted(isWishlisted(product._id));
    fetchRelated(product.category, product._id);
    fetchReviews(product._id);
  }, [product, fetchRelated, isWishlisted, fetchReviews]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', `/product/${id}`);
      navigate('/login');
      return;
    }
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      toast.error('Please enter a headline and comment for your review');
      return;
    }
    setSubmittingReview(true);
    try {
      await createReview({
        productId: product._id,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim()
      });
      toast.success('Review submitted successfully! It will appear once approved.');
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

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
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
        <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg min-h-[44px] px-2" aria-label="Go back to previous page">
          <ArrowLeft size={20} className="mr-2" aria-hidden="true" />
          Back to Products
        </button>
        <Card className="min-h-[50vh] flex flex-col items-center justify-center rounded-2xl border p-8 sm:p-12">
          <ErrorIllustration className="w-24 h-24 sm:w-32 sm:h-32 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Couldn't load product</h2>
          <p className="text-gray-500 mb-8 text-center max-w-md">{error}</p>
          <Button
             onClick={fetchProduct}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors shadow-md min-h-[44px]"
          >
            <RefreshCw size={20} aria-hidden="true" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
        <Card className="rounded-2xl border overflow-hidden flex flex-col md:flex-row animate-pulse">
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
        </Card>
      </div>
    );
  }

  const productHasVariants = hasVariants(product);
  const { sizes, colors } = getVariantOptions(product);
  const requiresSize = sizes.length > 0;
  const requiresColor = colors.length > 0;
  const selectedVariant = productHasVariants ? findVariant(product, selectedSize, selectedColor) : null;
  const selectionComplete = (!requiresSize || selectedSize) && (!requiresColor || selectedColor);
  const needsSelection = productHasVariants && !selectionComplete;
  const hasSale = product?.salePrice != null && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price);
  const basePrice = hasSale ? Number(product.salePrice) : Number(product.price);
  const activePrice = selectedVariant ? variantPrice(product, selectedVariant) : basePrice;
  const originalPrice = (hasSale || (selectedVariant && Number(selectedVariant.price) < Number(product.price))) ? Number(product.price) : null;
  const discountPercent = (originalPrice && originalPrice > activePrice) ? Math.round(((originalPrice - activePrice) / originalPrice) * 100) : 0;
  const activeStock = productHasVariants
    ? (selectedVariant ? (Number(selectedVariant.stock) || 0) : 0)
    : product.countInStock;
  const stockStatus = getStockStatus(activeStock, product?.lowStockThreshold);
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

  // Optimistic flip + success toast only after the context accepts the change
  // (guests are rejected with a login prompt, API failures surface an error).
  const handleWishlistToggle = async () => {
    if (!product) return;
    if (wishlisted) {
      const ok = await removeFromWishlist(product);
      if (ok) {
        setWishlisted(false);
        toast.success('Removed from wishlist');
      }
    } else {
      const ok = await addToWishlist(product);
      if (ok) {
        setWishlisted(true);
        toast.success('Saved to wishlist');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg min-h-[44px] px-2" aria-label="Go back to previous page">
        <ArrowLeft size={20} className="mr-2" aria-hidden="true" />
        Back to Products
      </button>

      <Card className="rounded-2xl border overflow-hidden flex flex-col md:flex-row">
        {/* F-22: deterministic square frame prevents layout shift while the image loads */}
        <div className="md:w-1/2 p-6 sm:p-8 bg-gray-50 flex justify-center items-center aspect-square">
          <img
            src={resolveImageUrl(product.image)}
            alt={product.title || 'Product image'}
            width="600"
            height="600"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
            className="h-full w-full object-contain motion-safe:hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="md:w-1/2 p-6 sm:p-8 md:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {product.category && (
              <span className="text-sm font-semibold text-teal-600 tracking-wider uppercase">
                {product.category}
              </span>
            )}
            {product.brand && (
              <>
                <span className="text-gray-300" aria-hidden="true">•</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  {product.brand}
                </span>
              </>
            )}
            {product.sku && (
              <span className="ml-auto text-xs text-gray-400 font-mono">
                SKU: {product.sku}
              </span>
            )}
          </div>

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
                : 'Not yet rated'}
            </span>
          </div>

          <p className="text-gray-600 text-base sm:text-lg mb-8 leading-relaxed">
            {product.description}
          </p>

          <div className="mt-auto flex items-baseline gap-3 pb-4 border-b border-gray-100 mb-6 flex-wrap">
            <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              {formatPrice(activePrice)}
            </span>
            {originalPrice && originalPrice > activePrice && (
              <>
                <span className="text-lg text-gray-400 line-through" aria-hidden="true">
                  {formatPrice(originalPrice)}
                </span>
                <span className="bg-red-50 text-red-600 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-red-100">
                  {discountPercent}% OFF
                </span>
              </>
            )}
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
                  {selectedVariant.sku ? <span className="text-gray-500"> · SKU {selectedVariant.sku}</span> : null}
                </p>
              )}
            </div>
          )}

          {!needsSelection && <StockBadge countInStock={activeStock} threshold={product?.lowStockThreshold} className="mb-4" />}
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
                wishlisted ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500'
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
      </Card>

      {/* Customer Reviews Section */}
      <section className="mt-10 sm:mt-12" aria-labelledby="reviews-heading">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 id="reviews-heading" className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1 h-7 bg-teal-500 rounded-full" aria-hidden="true" />
              Customer Reviews
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={product.rating?.rate} size={16} />
              <span className="text-sm font-bold text-gray-800">
                {Number(product.rating?.rate) || 0} out of 5
              </span>
              <span className="text-gray-400 text-sm">·</span>
              <span className="text-sm text-gray-500">
                {reviews.length ? `${reviews.length} customer review${reviews.length === 1 ? '' : 's'}` : `${formatNumber(product.rating?.count || 0)} global ratings`}
              </span>
            </div>
          </div>

          <Button
            onClick={() => {
              if (!user) {
                sessionStorage.setItem('redirectAfterLogin', `/product/${id}`);
                navigate('/login');
              } else {
                setShowReviewForm((v) => !v);
              }
            }}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl font-bold text-sm min-h-[44px] inline-flex items-center gap-2"
          >
            <MessageSquare size={16} aria-hidden="true" />
            {showReviewForm ? 'Cancel Review' : 'Write a Review'}
          </Button>
        </div>

        {/* Review Form Drawer / Card */}
        {showReviewForm && (
          <Card className="p-5 sm:p-6 rounded-2xl border border-teal-100 bg-teal-50/30 mb-8 animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Share your thoughts on this product</h3>
            <p className="text-xs text-gray-500 mb-4">Reviews help other shoppers make informed choices. All feedback is moderated.</p>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Your Rating
                </label>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating selection">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 rounded hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        size={26}
                        className={star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                  <span className="text-sm font-semibold text-gray-700 ml-2">
                    {reviewRating === 5 ? 'Excellent' : reviewRating === 4 ? 'Good' : reviewRating === 3 ? 'Average' : reviewRating === 2 ? 'Poor' : 'Terrible'}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="review-title" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Headline
                </label>
                <input
                  id="review-title"
                  type="text"
                  maxLength={100}
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="What's most important to know?"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="review-comment" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Detailed Review
                </label>
                <textarea
                  id="review-comment"
                  rows={4}
                  maxLength={1000}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="What did you like or dislike? How was the fit, material, or performance?"
                  className="w-full p-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500">
                  Posting as <span className="font-semibold text-gray-800">{user?.name}</span>
                </span>
                <Button
                  type="submit"
                  disabled={submittingReview}
                  className="px-6 py-2.5 rounded-xl font-bold min-h-[44px]"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="p-4 rounded-xl border border-gray-100 bg-white animate-pulse space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                <div className="h-4 w-48 bg-gray-200 rounded"></div>
                <div className="h-12 w-full bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <Card key={rev._id} className="p-4 sm:p-5 rounded-xl border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <StarRating rating={rev.rating} size={14} />
                    {rev.title && <span className="font-bold text-gray-900 text-sm">{rev.title}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(rev.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{rev.comment}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-800">{rev.userName || 'Verified Customer'}</span>
                  {rev.verified && (
                    <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium text-[11px]">
                      <CheckCircle2 size={12} aria-hidden="true" /> Verified Purchase
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
            <MessageSquare size={32} className="mx-auto text-gray-400 mb-2" aria-hidden="true" />
            <h3 className="font-bold text-gray-700 mb-1">No reviews yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              Have you tried this product? Share your experience with other shoppers.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (!user) {
                  sessionStorage.setItem('redirectAfterLogin', `/product/${id}`);
                  navigate('/login');
                } else {
                  setShowReviewForm(true);
                }
              }}
              className="px-5 py-2 rounded-xl text-sm font-bold min-h-[40px]"
            >
              Be the first to review
            </Button>
          </div>
        )}
      </section>

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
          <div role="status" aria-label="Loading related products" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailsPage;