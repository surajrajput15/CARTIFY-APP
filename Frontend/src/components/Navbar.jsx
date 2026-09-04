import { useState, useMemo, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Shield } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { useAuth } from '../context/authContext';
import { getFirstName } from '../utils/format';

const linkBase = 'flex items-center gap-1.5 font-medium transition-colors';
const linkInactive = 'text-gray-600 hover:text-teal-600';
const linkActiveBase = 'text-teal-600';

const navLinkClass = ({ isActive }) =>
  `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : linkInactive}`;

const Navbar = () => {
  const { cart } = useCart();
  const { user, logout } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  // Total units in cart (sum of all item quantities), not the number of distinct product rows.
  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    [cart]
  );

  // Safe accessor — never crashes if user.name is undefined/null
  const firstName = useMemo(() => getFirstName(user?.name), [user?.name]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/?search=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate('/');
    }
  }, [keyword, navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2 sm:gap-3">

          <NavLink to="/" className="flex-shrink-0">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-600 tracking-tight whitespace-nowrap">
              Cartify<span className="text-gray-800">.</span>
            </span>
          </NavLink>

          <form onSubmit={handleSearch} role="search" className="hidden md:flex flex-1 max-w-2xl relative mx-2 lg:mx-4 min-w-0">
            <label htmlFor="navbar-search" className="sr-only">Search products</label>
            <input
              id="navbar-search"
              type="text"
              placeholder="Search for products, brands and more..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full min-w-0 pl-4 pr-12 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-gray-50 text-gray-800"
            />
            <button type="submit" className="absolute right-0 top-0 h-full px-4 text-teal-600 hover:bg-teal-100 rounded-r-lg transition-colors" aria-label="Search">
              <Search size={20} aria-hidden="true" />
            </button>
          </form>

          <div className="flex items-center space-x-1 sm:space-x-3 lg:space-x-4 flex-shrink-0">

            <button
              type="button"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden text-gray-600 hover:text-teal-600 p-2 rounded-lg hover:bg-gray-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle search"
              aria-expanded={showMobileSearch}
            >
              <Search size={20} aria-hidden="true" />
            </button>

            {user ? (
              <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
                <NavLink to="/profile" aria-label="Profile" className={({ isActive }) =>
                  `${linkBase} font-bold ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                }>
                  <User size={20} aria-hidden="true" />
                  <span className="hidden sm:inline truncate max-w-[80px]">Hi, {firstName}</span>
                </NavLink>

                {user.isAdmin && (
                  <NavLink to="/admin" className={navLinkClass} aria-label="Admin dashboard">
                    <Shield size={20} aria-hidden="true" />
                    <span className="hidden lg:inline">Admin</span>
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-700 flex items-center gap-1.5 font-medium transition-colors min-w-[44px] min-h-[44px] px-2 rounded-lg hover:bg-red-50"
                  aria-label="Logout"
                >
                  <LogOut size={20} aria-hidden="true" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </div>
            ) : (
              <NavLink to="/login" className={navLinkClass}>
                <User size={20} aria-hidden="true" />
                <span className="hidden sm:inline">Login</span>
              </NavLink>
            )}

            <NavLink
              to="/cart"
              aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : linkInactive}`
              }
            >
              <div className="relative inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
                <ShoppingCart size={20} aria-hidden="true" />
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm px-1 leading-none"
                  aria-hidden="true"
                >
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
                <span className="sr-only" aria-live="polite" aria-atomic="true">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
                </span>
              </div>
              <span className="hidden sm:inline">Cart</span>
            </NavLink>
          </div>

        </div>
      </div>

      {showMobileSearch && (
        <div className="md:hidden bg-gray-50 border-t border-gray-100 p-3 shadow-inner animate-fade-in-up">
          <form onSubmit={(e) => { handleSearch(e); setShowMobileSearch(false); }} className="relative" role="search">
            <label htmlFor="navbar-search-mobile" className="sr-only">Search products</label>
            <input
              id="navbar-search-mobile"
              type="text"
              placeholder="Search for products, brands..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-4 pr-12 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-800 text-sm"
              autoFocus
            />
            <button type="submit" className="absolute right-0 top-0 h-full px-4 text-teal-600 hover:bg-teal-50 rounded-r-xl transition-colors" aria-label="Search">
              <Search size={18} />
            </button>
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
