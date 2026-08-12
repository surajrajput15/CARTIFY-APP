import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Shield } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { useAuth } from '../context/authContext';

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
  const cartItemCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/?search=${keyword}`);
    } else {
      navigate('/');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">

          <NavLink to="/" className={navLinkClass}>
            <span className="text-3xl font-extrabold text-teal-600 tracking-tight">Cartify.</span>
          </NavLink>

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl relative mx-4">
            <input
              type="text"
              placeholder="Search for products, brands and more..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-4 pr-12 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-gray-50 text-gray-800"
            />
            <button type="submit" className="absolute right-0 top-0 h-full px-4 text-teal-600 hover:bg-teal-100 rounded-r-lg transition-colors" aria-label="Search">
              <Search size={20} aria-hidden="true" />
            </button>
          </form>

          <div className="flex items-center space-x-2 sm:space-x-4">

            <button
              type="button"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden text-gray-600 hover:text-teal-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Toggle search"
            >
              <Search size={20} aria-hidden="true" />
            </button>

            {user ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <NavLink to="/profile" className={({ isActive }) =>
                  `${linkBase} font-bold ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                }>
                  <User size={20} aria-hidden="true" />
                  <span className="hidden sm:inline">Hi, {user.name.split(' ')[0]}</span>
                </NavLink>

                {user.isAdmin && (
                  <NavLink to="/admin" className={navLinkClass} aria-label="Admin dashboard">
                    <Shield size={20} aria-hidden="true" />
                    <span className="hidden sm:inline">Admin</span>
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-700 flex items-center gap-1.5 font-medium transition-colors"
                  aria-label="Logout"
                >
                  <LogOut size={20} aria-hidden="true" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <NavLink to="/login" className={navLinkClass}>
                <User size={20} aria-hidden="true" />
                <span className="hidden sm:inline">Login</span>
              </NavLink>
            )}

            <NavLink to="/cart" className={({ isActive }) =>
              `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : linkInactive}`
            }>
              <div className="relative inline-flex items-center justify-center">
                <ShoppingCart size={20} aria-hidden="true" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm px-1 leading-none">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">Cart</span>
            </NavLink>
          </div>

        </div>
      </div>

      {showMobileSearch && (
        <div className="md:hidden bg-gray-50 border-t border-gray-100 p-3 shadow-inner animate-fade-in-up">
          <form onSubmit={(e) => { handleSearch(e); setShowMobileSearch(false); }} className="relative">
            <input
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
