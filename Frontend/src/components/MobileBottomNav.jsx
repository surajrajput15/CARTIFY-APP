import { NavLink } from 'react-router-dom';
import {
  Home, ShoppingCart, Heart, User, LayoutGrid,
  Shield, Truck, Package, Warehouse
} from 'lucide-react';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/cartContext';
import { useWishlist } from '../context/WishlistContext';

const MobileBottomNav = () => {
  const { user } = useAuth();
  const { cart } = useCart();
  const { wishlist } = useWishlist();

  const cartCount = (cart || []).reduce((s, it) => s + (Number(it.quantity) || 1), 0);
  const wishCount = (wishlist || []).length;

  const isDelivery = user?.role === 'delivery' || user?.role === 'driver';
  const isAdmin = user?.isAdmin || user?.role === 'admin';

  const base = 'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[52px] text-[10px] font-medium transition-colors';
  const inactive = 'text-gray-500 hover:text-teal-600';
  const active = 'text-teal-600';

  const items = [];
  items.push(
    <NavLink key="home" to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="Home">
      <Home size={20} aria-hidden="true" />
      <span>Home</span>
    </NavLink>
  );
  items.push(
    <NavLink key="shop" to="/?category=all" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="Browse by category">
      <LayoutGrid size={20} aria-hidden="true" />
      <span>Categories</span>
    </NavLink>
  );
  if (isDelivery) {
    items.push(
      <NavLink key="delivery" to="/delivery" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="Delivery dashboard">
        <Truck size={20} aria-hidden="true" />
        <span>Deliveries</span>
      </NavLink>
    );
  } else if (user?.role === 'warehouse') {
    items.push(
      <NavLink key="warehouse" to="/warehouse" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="Warehouse dashboard">
        <Warehouse size={20} aria-hidden="true" />
        <span>Warehouse</span>
      </NavLink>
    );
  } else if (isAdmin) {
    items.push(
      <NavLink key="admin" to="/admin" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="Admin dashboard">
        <Shield size={20} aria-hidden="true" />
        <span>Admin</span>
      </NavLink>
    );
  } else {
    items.push(
      <NavLink key="wishlist" to="/wishlist" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label={`Wishlist, ${wishCount} item${wishCount === 1 ? '' : 's'}`}>
        <span className="relative inline-flex items-center justify-center">
          <Heart size={20} aria-hidden="true" />
          {wishCount > 0 && (
            <span className="absolute -top-1 -right-2.5 min-w-[16px] h-[16px] rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none" aria-hidden="true">
              {wishCount > 99 ? '99+' : wishCount}
            </span>
          )}
        </span>
        <span>Wishlist</span>
      </NavLink>
    );
    items.push(
      <NavLink key="orders" to="/profile?tab=orders" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label="My orders">
        <Package size={20} aria-hidden="true" />
        <span>Orders</span>
      </NavLink>
    );
  }

  items.push(
    <NavLink key="cart" to="/cart" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
      <span className="relative inline-flex items-center justify-center">
        <ShoppingCart size={20} aria-hidden="true" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-2.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none" aria-hidden="true">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </span>
      <span>Cart</span>
    </NavLink>
  );
  items.push(
    <NavLink key="account" to={user ? '/profile' : '/login'} className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label={user ? 'Profile' : 'Login'}>
      <User size={20} aria-hidden="true" />
      <span>{user ? 'Account' : 'Login'}</span>
    </NavLink>
  );

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]"
      aria-label="Mobile bottom navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {items}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
