import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, User, Search, LogOut, Shield, Truck, Warehouse,
  Heart, Phone, HelpCircle, BadgePercent, ChevronDown,
  Ticket, Bell, Package
} from 'lucide-react';
import { useCart } from '../context/cartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/authContext';
import { getFirstName } from '../utils/format';
import { fetchCategories } from '../services/categoriesApi';
import { PRODUCT_CATEGORIES } from '../utils/constants';
import SearchBox from './SearchBox';
import LocationBar from './LocationBar';
import { recordSearch } from '../utils/recentSearches';

const linkBase = 'flex items-center gap-1.5 font-medium transition-colors';
const linkInactive = 'text-gray-600 hover:text-teal-600';
const linkActiveBase = 'text-teal-600';

const navLinkClass = ({ isActive }) =>
  `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : linkInactive}`;

const Navbar = () => {
  const { cart } = useCart();
  const { user, logout } = useAuth();
  const { wishlist } = useWishlist();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const adminMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    [cart]
  );
  const wishlistCount = (wishlist || []).length;
  const firstName = useMemo(() => getFirstName(user?.name), [user?.name]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial category fetch
    setCategoriesLoading(true);
    setCategoriesError(false);
    fetchCategories(true)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) && res.data.length
          ? res.data.filter((c) => c && typeof c.name === 'string')
          : [];
        setCategories(list);
        // Fall back to the canonical constant list so the rail is never empty.
        if (!list.length) setCategories([]);
        setCategoriesError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCategories([]);
        setCategoriesError(true);
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, [categoryRetry]);

  const handleSearch = useCallback((q) => {
    recordSearch(q);
    if (q && q.trim()) {
      navigate(`/?search=${encodeURIComponent(q.trim())}`);
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Both navbar menus: dismiss on outside click, Escape, or route change.
  useEffect(() => {
    if (!dropdownOpen && !adminMenuOpen) return undefined;

    const onPointerDown = (event) => {
      if (dropdownRef.current?.contains(event.target) || adminMenuRef.current?.contains(event.target)) return;
      setDropdownOpen(false);
      setAdminMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setDropdownOpen(false);
      setAdminMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen, adminMenuOpen]);

  // Navigating away (deep link from a menu, brand click, browser back) closes menus.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync menus to route change
    setDropdownOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname, location.search]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  const goCategory = useCallback((slug) => {
    if (slug && slug !== 'all') {
      navigate(`/?category=${encodeURIComponent(String(slug).toLowerCase())}`);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const searchParams = new URLSearchParams(location.search);
  const activeCat = searchParams.get('category') || 'all';

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">

      {/* TIER 1 — utility strip (desktop only; hidden on mobile to save 32px) */}
      <div className="hidden md:block bg-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-8 text-xs">
            <div className="flex items-center gap-4 text-teal-50">
              <LocationBar />
              <span className="hidden md:flex items-center gap-1.5 text-teal-100" aria-hidden="true">
                <Truck size={13} />
                <span>Fast &amp; insured delivery</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="flex items-center gap-1.5 text-teal-50 hover:text-white transition-colors min-w-[44px] min-h-[44px] -my-4 px-2 justify-center"
                aria-label="Featured picks"
                onClick={() => { navigate('/?category=all'); setTimeout(() => document.querySelector('#featured-heading')?.scrollIntoView({ behavior: 'smooth' }), 120); }}
              >
                <BadgePercent size={13} aria-hidden="true" />
                <span className="hidden sm:inline font-medium">Featured</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-teal-50 hover:text-white transition-colors min-w-[44px] min-h-[44px] -my-4 px-2 justify-center"
                aria-label="Help and support"
                onClick={() => navigate('/faq')}
              >
                <HelpCircle size={13} aria-hidden="true" />
                <span className="hidden sm:inline font-medium">Help</span>
              </button>
              <span className="hidden lg:flex items-center gap-1.5 text-teal-100" aria-hidden="true">
                <Phone size={13} />
                <span>+91 98765 43210</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TIER 2 — main bar */}
      <nav aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 md:h-16 gap-1.5 sm:gap-3">

            <NavLink to="/" className="flex-shrink-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-600 tracking-tight whitespace-nowrap">
                Cartify<span className="text-gray-800">.</span>
              </span>
            </NavLink>

            <div className="hidden md:flex flex-1 max-w-2xl relative mx-2 lg:mx-4 min-w-0">
              <SearchBox onSearch={handleSearch} />
            </div>

            <div className="flex items-center gap-1 sm:gap-3 lg:gap-4 flex-shrink-0">

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
                <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      id="account-menu-button"
                      onClick={() => { setDropdownOpen((o) => !o); setAdminMenuOpen(false); }}
                      aria-haspopup="true"
                      aria-expanded={dropdownOpen}
                      aria-label="Account menu"
                      className="flex items-center gap-1 p-2 rounded-lg text-teal-700 hover:text-teal-800 hover:bg-teal-50 transition-colors min-h-[44px] group"
                    >
                      <User size={20} aria-hidden="true" />
                      <span className="hidden sm:inline truncate max-w-[80px] font-semibold">Hi, {firstName}</span>
                      <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div
                        id="account-menu"
                        className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50"
                        role="menu"
                        aria-labelledby="account-menu-button"
                      >
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900 truncate pr-2">{user.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{user.role ?? 'customer'} account</p>
                        </div>
                        <NavLink to="/profile" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setDropdownOpen(false)}>
                          <User size={16} aria-hidden="true" /> My Profile
                        </NavLink>
                        <NavLink to="/profile?tab=orders" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setDropdownOpen(false)}>
                          <ShoppingCart size={16} aria-hidden="true" /> My Orders
                        </NavLink>
                        <NavLink to="/profile?tab=coupons" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setDropdownOpen(false)}>
                          <Ticket size={16} aria-hidden="true" /> My Coupons
                        </NavLink>
                        <NavLink to="/wishlist" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setDropdownOpen(false)}>
                          <Heart size={16} aria-hidden="true" /> Wishlist
                        </NavLink>
                        <NavLink to="/profile?tab=notifications" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setDropdownOpen(false)}>
                          <Bell size={16} aria-hidden="true" /> Notifications
                        </NavLink>
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button type="button" role="menuitem" onClick={() => { setDropdownOpen(false); handleLogout(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <LogOut size={16} aria-hidden="true" /> Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {user.isAdmin && (
                    <div className="relative" ref={adminMenuRef}>
                      <button
                        type="button"
                        onClick={() => { setAdminMenuOpen((o) => !o); setDropdownOpen(false); }}
                        aria-haspopup="true"
                        aria-expanded={adminMenuOpen}
                        aria-label="Admin control menu"
                        className="flex items-center gap-1 p-2 rounded-lg text-teal-700 hover:text-teal-800 hover:bg-teal-50 transition-colors min-h-[44px]"
                      >
                        <Shield size={20} aria-hidden="true" />
                        <span className="hidden lg:inline font-semibold">Admin</span>
                        <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {adminMenuOpen && (
                        <div
                          className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50"
                          role="menu"
                          aria-label="Admin control menu"
                        >
                          <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Full control</p>
                          </div>
                          <NavLink to="/admin" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <Shield size={16} aria-hidden="true" /> Admin Dashboard
                          </NavLink>
                          <NavLink to="/delivery" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <Truck size={16} aria-hidden="true" /> Delivery Portal
                          </NavLink>
                          <NavLink to="/warehouse" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <Warehouse size={16} aria-hidden="true" /> Warehouse Portal
                          </NavLink>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <p className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-gray-400">Manage</p>
                          </div>
                          <NavLink to="/admin?tab=users" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <User size={16} aria-hidden="true" /> Users
                          </NavLink>
                          <NavLink to="/admin?tab=orders" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <ShoppingCart size={16} aria-hidden="true" /> Orders
                          </NavLink>
                          <NavLink to="/admin?tab=products" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <Package size={16} aria-hidden="true" /> Products
                          </NavLink>
                          <NavLink to="/admin?tab=coupons" role="menuitem" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors" onClick={() => setAdminMenuOpen(false)}>
                            <Ticket size={16} aria-hidden="true" /> Coupons
                          </NavLink>
                        </div>
                      )}
                    </div>
                  )}
                  {user.role === 'delivery' && (
                    <NavLink to="/delivery" aria-label="Delivery dashboard" className={({ isActive }) =>
                      `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                    }>
                      <Truck size={20} aria-hidden="true" />
                      <span className="hidden lg:inline">Deliveries</span>
                    </NavLink>
                  )}
                  {user.role === 'warehouse' && (
                    <NavLink to="/warehouse" aria-label="Warehouse dashboard" className={({ isActive }) =>
                      `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                    }>
                      <Warehouse size={20} aria-hidden="true" />
                      <span className="hidden lg:inline">Warehouse</span>
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

              {!user?.isAdmin && (
              <NavLink
                to="/wishlist"
                aria-label={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? '' : 's'}`}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                }
              >
                <div className="relative inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
                  <Heart size={20} aria-hidden="true" />
                  {wishlistCount > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm px-1 leading-none"
                      aria-hidden="true"
                    >
                      {wishlistCount > 99 ? '99+' : wishlistCount}
                    </span>
                  )}
                  <span className="sr-only" aria-live="polite" aria-atomic="true">
                    {wishlistCount} item{wishlistCount === 1 ? '' : 's'} in wishlist
                  </span>
                </div>
                <span className="hidden sm:inline">Wishlist</span>
              </NavLink>
              )}

              <NavLink
                to="/cart"
                aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? `${linkActiveBase} border-b-2 border-teal-500 pb-0.5` : 'text-teal-700 hover:text-teal-800'}`
                }
              >
                <div className="relative inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
                  <ShoppingCart size={20} aria-hidden="true" />
                  {cartItemCount > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm px-1 leading-none"
                      aria-hidden="true"
                    >
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                  <span className="sr-only" aria-live="polite" aria-atomic="true">
                    {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
                  </span>
                </div>
                <span className="hidden sm:inline">Cart</span>
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* TIER 3 — sticky category rail (real categories, loading/error handled) */}
      <div className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-11 gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => goCategory('all')}
              className={`relative flex-shrink-0 min-w-[44px] min-h-[44px] px-3 rounded-full text-sm font-medium transition-colors ${
                activeCat === 'all' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-teal-50 hover:text-teal-700'
              }`}
              aria-pressed={activeCat === 'all'}
            >
              All
              {activeCat === 'all' && (
                <span className="absolute bottom-1.5 left-4 right-4 h-[3px] rounded-full bg-white" aria-hidden="true" />
              )}
            </button>
            <span className="flex-shrink-0 w-px h-4 bg-gray-200" aria-hidden="true" />
            {categoriesLoading ? (
              // Lightweight shimmer pills — never a stuck text label.
              [1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="flex-shrink-0 w-16 h-7 rounded-full bg-gray-100 animate-pulse"
                  aria-hidden="true"
                />
              ))
            ) : categoriesError && categories.length === 0 ? (
              <div className="flex items-center gap-2 px-1 text-xs" role="alert">
                <span className="text-red-500 font-medium">Couldn't load categories.</span>
                <button
                  type="button"
                  onClick={() => setCategoryRetry((k) => k + 1)}
                  className="text-teal-600 font-bold underline min-h-[44px] px-1"
                >
                  Retry
                </button>
              </div>
            ) : categories.length > 0 ? categories.map((c) => (
              <button
                key={c._id || c.name}
                type="button"
                onClick={() => goCategory(c.slug || c.name)}
                className={`relative flex-shrink-0 min-w-[44px] min-h-[44px] px-3 rounded-full text-sm font-medium capitalize transition-colors ${
                  activeCat === (c.slug || c.name) ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                }`}
                aria-pressed={activeCat === (c.slug || c.name)}
              >
                {c.name}
                {activeCat === (c.slug || c.name) && (
                  <span className="absolute bottom-1.5 left-4 right-4 h-[3px] rounded-full bg-white" aria-hidden="true" />
                )}
              </button>
            )) : (
              // API reachable but empty taxonomy — show canonical list so the rail is usable.
              PRODUCT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => goCategory(cat)}
                  className={`relative flex-shrink-0 min-w-[44px] min-h-[44px] px-3 rounded-full text-sm font-medium capitalize transition-colors ${
                    activeCat === cat ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                  aria-pressed={activeCat === cat}
                >
                  {cat}
                  {activeCat === cat && (
                    <span className="absolute bottom-1.5 left-4 right-4 h-[3px] rounded-full bg-white" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile search panel (slides below header) */}
      {showMobileSearch && (
        <div className="md:hidden bg-gray-50 border-t border-gray-100 p-3 shadow-inner animate-fade-in-up">
          <div className="relative">
            <SearchBox
              mobile
              onSearch={(q) => { handleSearch(q); setShowMobileSearch(false); }}
            />
          </div>
        </div>
      )}

    </header>
  );
};

export default Navbar;
