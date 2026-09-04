import { Edit2, X, Loader2, Check } from 'lucide-react';
import { getFirstName } from '../../utils/format';

const ProfileInfo = ({ user, isEditing, editName, updateLoading, onToggleEdit, onEditNameChange, onSave }) => (
  <section
    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 animate-fade-in-up"
    aria-labelledby="profile-info-heading"
  >
    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
      <h2 id="profile-info-heading" className="text-lg sm:text-xl font-bold text-gray-800">Personal Information</h2>
      {!isEditing ? (
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 rounded-lg hover:bg-teal-50 transition-colors"
        >
          <Edit2 size={16} aria-hidden="true" /> Edit Profile
        </button>
      ) : (
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700 min-h-[44px] px-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={16} aria-hidden="true" /> Cancel
        </button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      <div>
        <label htmlFor="profile-name" className="block text-sm font-medium text-gray-500 mb-2">Full Name</label>
        {isEditing ? (
          <div className="flex gap-2">
            <input
              id="profile-name"
              type="text"
              value={editName}
              onChange={onEditNameChange}
              className="w-full px-4 py-2.5 rounded-lg border border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium min-h-[44px]"
              autoFocus
              maxLength={100}
            />
            <button
              onClick={onSave}
              disabled={updateLoading}
              aria-label="Save name"
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center justify-center min-w-[44px] min-h-[44px] disabled:opacity-50"
            >
              {updateLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">
            {user?.name || 'Not set'}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-2">
          Email Address <span className="text-xs text-gray-400">(cannot be changed)</span>
        </label>
        <p className="text-gray-500 font-medium bg-gray-100 p-3 rounded-lg border border-gray-200 cursor-not-allowed select-all" title={user?.email}>
          {user?.email || 'Not set'}
        </p>
      </div>
    </div>
  </section>
);

export default ProfileInfo;
