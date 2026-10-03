import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, AlertCircle } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { SkeletonCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Button from '../components/ui/Button';
import { useWishlist } from '../context/WishlistContext';
import { usePageTitle } from '../hooks/usePageTitle';

const WishlistPage = () => {
  usePageTitle('Wishlist');
  const navigate = useNavigate();
  const { wishlist, wishlistLoading, wishlistError, refreshWishlist } = useWishlist();

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  if (wishlistLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">My Wishlist</h1>
        <div role="status" aria-label="Loading wishlist" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <SkeletonCard key={n} />
          ))}
        </div>
      </div>
    );
  }

  if (wishlistError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">My Wishlist</h1>
        <div
          role="alert"
          className="text-center py-12 sm:py-16 bg-gray-50 rounded-2xl border border-gray-100 px-4"
        >
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">Wishlist could not load</h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base mb-6">
            We couldn't reach the server to load your saved items. Your wishlist is safe — try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={refreshWishlist}
              className="px-6 py-3 rounded-lg font-bold transition-colors min-h-[44px] inline-flex items-center justify-center"
            >
              Try Again
            </Button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-lg font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              Browse products
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={Heart}
          title="Your Wishlist is Empty"
          description="You haven't saved any products to your wishlist yet. Explore our catalog and find items you love."
          actionLabel="Explore Products"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          My Wishlist
          <span className="ml-2 text-gray-500 font-normal text-base sm:text-lg">
            ({wishlist.length} product{wishlist.length !== 1 ? 's' : ''})
          </span>
        </h1>
        <button
          onClick={() => navigate('/')}
          className="text-teal-600 hover:text-teal-700 font-medium text-sm sm:text-base transition-colors flex items-center gap-1.5"
        >
          Browse products
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {wishlist.map((product) => (
          <ProductCard key={String(product?._id || product?.id || product?.productId || '')} product={product} />
        ))}
      </div>
    </div>
  );
};

export default WishlistPage;
