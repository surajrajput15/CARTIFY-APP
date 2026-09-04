import { User, Package, MapPin, Settings, LogOut } from 'lucide-react';
import { getFirstName, getInitial } from '../../utils/format';

const TABS = [
  { key: 'profile', label: 'Profile Information', icon: User },
  { key: 'orders', label: 'My Orders', icon: Package },
  { key: 'addresses', label: 'Manage Addresses', icon: MapPin },
  { key: 'settings', label: 'Account Settings', icon: Settings },
];

const ProfileSidebar = ({ user, activeTab, onTabChange, onLogout }) => (
  <div className="w-full md:w-1/4">
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:sticky md:top-24">
      <div className="flex items-center space-x-4 mb-6 p-2">
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

      <nav className="space-y-1" aria-label="Account navigation">
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
