import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, ShoppingCart, User, LayoutGrid,
  Shield, Truck, Warehouse
} from 'lucide-react';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/cartContext';

const MobileBottomNav = () => {
  const { user } = useAuth();
  const { cart } = useCart();

  const cartCount = (cart || []).reduce((s, it) => s + (Number(it.quantity) || 1), 0);

  const isDelivery = user?.role === 'delivery' || user?.role === 'driver';
  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    ['inventory_manager', 'order_manager', 'delivery_manager', 'customer_support', 'analyst'].includes(user?.role)
  );
  // NavLink matches pathname only, so on "/" both Home and Categories would
  // appear active. Use the ?category= query to keep exactly one tab active.
  const hasCategoryQuery = useLocation().search.includes('category');

  const base = 'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[52px] text-[10px] font-medium transition-colors';
  const inactive = 'text-gray-500 hover:text-teal-600';
  const active = 'text-teal-600 font-bold shadow-[inset_0_2px_0_0_#0d9488]';

  const items = [];
  items.push(
    <NavLink key="home" to="/" end className={({ isActive }) => `${base} ${isActive && !hasCategoryQuery ? active : inactive}`} aria-label="Home">
      <Home size={20} aria-hidden="true" />
      <span>Home</span>
    </NavLink>
  );
  items.push(
    <NavLink key="shop" to="/?category=all" className={() => `${base} ${hasCategoryQuery ? active : inactive}`} aria-label="Browse by category">
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
      <NavLink
        key="admin"
        to="/admin"
        className={({ isActive }) => `${base} ${isActive ? 'text-indigo-700 font-bold shadow-[inset_0_2px_0_0_#4338ca]' : 'text-indigo-600 hover:text-indigo-700'}`}
        aria-label="Admin command center"
      >
        <span className="relative">
          <Shield size={20} aria-hidden="true" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        </span>
        <span className="font-semibold">Admin</span>
      </NavLink>
    );
  }


  items.push(
    <NavLink key="cart" to="/cart" className={({ isActive }) => `${base} ${isActive ? active : inactive}`} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
      <span className="relative inline-flex items-center justify-center">
        <ShoppingCart size={20} aria-hidden="true" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none" aria-hidden="true">
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
