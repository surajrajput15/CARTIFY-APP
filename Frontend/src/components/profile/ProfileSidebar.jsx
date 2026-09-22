import { User, Package, MapPin, Settings, LogOut, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFirstName, getInitial } from '../../utils/format';

const TABS = [
  { key: 'profile', label: 'Profile Information', icon: User },
  { key: 'orders', label: 'My Orders', icon: Package },
  { key: 'addresses', label: 'Manage Addresses', icon: MapPin },
  { key: 'settings', label: 'Account Settings', icon: Settings },
];

// Dedicated "wishlist" quick-access row rendered below the settings tab for
// authenticated profile users. Navigates to the standalone /wishlist page
// (wishlist is managed there instead of as a profile tab).
const WishlistEntry = ({ onNavigate }) => (
  <button
    type="button"
    onClick={onNavigate}
    className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:text-teal-700 hover:bg-teal-50 transition-colors min-h-[44px]"
    aria-label="Open wishlist"
  >
    <Heart size={18} className="flex-shrink-0" aria-hidden="true" />
    <span className="flex-1 text-left">Wishlist</span>
    <span className="text-gray-300 text-xs" aria-hidden="true">→</span>
  </button>
);

const ProfileSidebar = ({ user, activeTab, onTabChange, onLogout }) => (
  <div className="w-full md:w-1/4">
    {/* Desktop: stacked sidebar card. Mobile: compact identity row + horizontally
        scrollable tab pills (scrollbar hidden, swipe-friendly, no squished stack). */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:sticky md:top-24">
      {/* Identity — compact horizontal row on mobile, spacious block on desktop */}
      <div className="flex items-center space-x-4 mb-4 md:mb-6 p-2">
        <div
          className="h-12 w-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
          aria-hidden="true"
        >
          {getInitial(user?.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500">Hello,</p>
          <p className="font-bold text-gray-800 truncate" title={user?.name || ''}>
            {getFirstName(user?.name)}
          </p>
        </div>
      </div>

      {/* Mobile tab strip: horizontal scroll with snap + hidden scrollbar */}
      <nav
        className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        aria-label="Account navigation"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors flex-shrink-0 snap-start min-h-[44px] ${
              activeTab === key
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold border border-red-200 text-red-500 bg-white hover:bg-red-50 transition-colors flex-shrink-0 snap-start min-h-[44px]"
          aria-label="Logout"
        >
          <LogOut size={16} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </nav>

      {/* Desktop vertical nav */}
      <nav className="hidden md:block space-y-1" aria-label="Account navigation">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] ${
              activeTab === key
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}

        <hr className="my-2 border-gray-100" />
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors min-h-[44px]"
          aria-label="Logout"
        >
          <LogOut size={20} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  </div>
);

export default ProfileSidebar;
