import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/cartContext';
import { ShoppingCart, Star, ArrowLeft, RefreshCw, AlertTriangle, Minus, Plus } from 'lucide-react';
import { getStockStatus } from '../utils/stockStatus';
import { resolveImageUrl } from '../utils/imageUrl';
import StockBadge from '../components/StockBadge';
import toast from 'react-hot-toast';
import { fetchProductById, fetchProducts } from '../services/productsApi';
import ProductCard from '../components/ProductCard';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState(null);
  const { addToCart } = useCart();

  // Derived loading states — avoids setting state synchronously inside effects.
  const loading = product === null;
  const relatedLoading = relatedProducts === null;

  const fetchProduct = useCallback(() => {
    // State updates happen inside promise callbacks only — never synchronously within the
    // effect that calls this, which keeps the render cycle clean.
    fetchProductById(id)
      .then((response) => {
        setProduct(response.data);
        setError(null);
      })
      .catch((err) => {
        console.error("Error fetching product:", err);
        const message = err.response?.data?.message || "Failed to load product details";
        setError(message);
        toast.error(message);
      });
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProduct();
  }, [fetchProduct]);

  const fetchRelated = useCallback((category, excludeId) => {
    fetchProducts({ category, limit: 5 })
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : response.data.products || [];
        setRelatedProducts(data.filter((p) => p._id !== excludeId).slice(0, 4));
      })
      .catch(() => {
        setRelatedProducts([]);
      });
  }, []);

  useEffect(() => {
    if (!product) return;
    fetchRelated(product.category, product._id);
  }, [product, fetchRelated]);

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
        <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg" aria-label="Go back to previous page">
          <ArrowLeft size={20} className="mr-2" />
          Back to Products
        </button>
        <div className="min-h-[50vh] flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
          <div className="bg-red-50 p-4 rounded-full mb-6">
            <AlertTriangle size={48} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Failed to Load Product</h2>
          <p className="text-gray-500 mb-8 text-center max-w-md">{error}</p>
          <button
            onClick={fetchProduct}
            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md"
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
            <div className="h-[400px] w-full bg-gray-200 rounded-xl"></div>
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

  const maxQty = product?.countInStock > 0 ? product.countInStock : 20;
  const stockStatus = getStockStatus(product.countInStock);
  const decreaseQty = () => setQuantity(q => Math.max(1, q - 1));
  const increaseQty = () => setQuantity(q => Math.min(maxQty, q + 1));

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <button onClick={handleGoBack} className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg" aria-label="Go back to previous page">
        <ArrowLeft size={20} className="mr-2" />
        Back to Products
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-1/2 p-8 bg-gray-50 flex justify-center items-center">
          <img 
            src={resolveImageUrl(product.image)} 
            alt={product.title} 
            loading="lazy"
            className="max-h-[400px] object-contain hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <span className="text-sm font-semibold text-teal-600 tracking-wider uppercase mb-2">
            {product.category}
          </span>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {product.title}
          </h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
              <Star className="text-yellow-400 fill-current mr-1" size={18} aria-hidden="true" />
              <span className="font-bold text-gray-700">{product.rating?.rate}</span>
              <span className="text-gray-500 text-sm ml-1">({product.rating?.count} reviews)</span>
            </div>
          </div>
          
          <p className="text-gray-600 text-lg mb-8 leading-relaxed">
            {product.description}
          </p>
          
          <div className="mt-auto flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-gray-100 mb-6">
            <span className="text-4xl font-extrabold text-gray-900">
              ₹{product.price}
            </span>
          </div>

          <StockBadge countInStock={product.countInStock} className="mb-4" />

          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-bold text-gray-700">Quantity:</span>
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
              <button
                onClick={decreaseQty}
                disabled={quantity <= 1}
                className="p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                aria-label="Decrease quantity"
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <span className="w-8 text-center font-bold text-gray-900 text-lg" aria-live="polite" aria-label={`Quantity ${quantity}`}>
                {quantity}
              </span>
              <button
                onClick={increaseQty}
                disabled={quantity >= maxQty}
                className="p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                aria-label="Increase quantity"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button 
            onClick={() => {
              addToCart(product, quantity);
              toast.success(`Added ${quantity} item(s) to cart`);
            }}
            disabled={stockStatus?.disabled}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors shadow-lg flex justify-center items-center gap-2 ${
              stockStatus?.disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 shadow-gray-200'
                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-200'
            }`}
          >
            <ShoppingCart size={24} aria-hidden="true" />
            {stockStatus?.disabled ? 'Out of Stock' : `Add to Cart (${quantity})`}
          </button>
        </div>
      </div>

      {relatedProducts?.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <span className="w-1 h-7 bg-teal-500 rounded-full" aria-hidden="true" />
            Related Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp._id} product={rp} />
            ))}
          </div>
        </section>
      )}

      {relatedLoading && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <span className="w-1 h-7 bg-teal-500 rounded-full" aria-hidden="true" />
            Related Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-56 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default ProductDetailsPage;