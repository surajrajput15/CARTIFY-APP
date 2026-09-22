import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { SkeletonCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/authContext';

const WishlistPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wishlist, wishlistLoading, refreshWishlist } = useWishlist();

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  if (wishlistLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">My Wishlist</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <SkeletonCard key={n} />
          ))}
        </div>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={Heart}
          title="Wishlist empty hai"
          description="Abhi tak koi product wishlist mein nahi hai. Products explore karo aur pasand ka product save karo."
          actionLabel="Browse products"
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
