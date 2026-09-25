import { Edit2, X, Loader2, Check, Lock } from 'lucide-react';
import { formatDate, getInitial } from '../../utils/format';

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

const ProfileInfo = ({ user, isEditing, editName, editGender, updateLoading, onToggleEdit, onEditNameChange, onEditGenderChange, onSave, onGoToSettings }) => (
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

    {/* Identity block: initials avatar + name/email/member-since summary */}
    <div className="flex items-center gap-4 mb-6">
      <div
        className="h-14 w-14 sm:h-16 sm:w-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold text-2xl flex-shrink-0"
        aria-hidden="true"
      >
        {getInitial(user?.name)}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-gray-900 text-base sm:text-lg truncate" title={user?.name || ''}>
          {user?.name || 'Not set'}
        </p>
        <p className="text-sm text-gray-500 truncate" title={user?.email || ''}>{user?.email || 'Not set'}</p>
        {user?.createdAt && (
          <p className="text-xs text-gray-400 mt-0.5">Member since {formatDate(user.createdAt)}</p>
        )}
      </div>
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
              onKeyDown={(e) => { if (e.key === 'Enter' && !updateLoading) onSave(); }}
              className="w-full px-4 py-2.5 rounded-lg border border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium min-h-[44px]"
              autoFocus
              maxLength={100}
              aria-describedby="profile-name-hint"
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
        {isEditing && (
          <p id="profile-name-hint" className="text-xs text-gray-400 mt-1.5">
            Press Enter to save — changes persist to your account.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="profile-gender" className="block text-sm font-medium text-gray-500 mb-2">Your Gender</label>
        {isEditing ? (
          <select
            id="profile-gender"
            value={editGender}
            onChange={onEditGenderChange}
            className="w-full px-4 py-2.5 rounded-lg border border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium min-h-[44px] bg-white"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        ) : (
          <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">
            {GENDER_LABELS[user?.gender] || 'Not set'}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="profile-email" className="block text-sm font-medium text-gray-500 mb-2">
          Email Address <span className="text-xs text-gray-400">(cannot be changed)</span>
        </label>
        <p
          id="profile-email"
          className="text-gray-500 font-medium bg-gray-100 p-3 rounded-lg border border-gray-200 cursor-not-allowed select-all break-all"
          title={user?.email}
        >
          {user?.email || 'Not set'}
        </p>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-500 mb-2">Password</span>
        {user?.hasPassword ? (
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="flex items-center gap-2 text-gray-700 font-semibold" aria-label="Password is set">
              <Lock size={16} className="text-gray-400" aria-hidden="true" /> ••••••••
            </span>
            <button
              onClick={onGoToSettings}
              className="text-sm font-bold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="flex items-center gap-2 text-gray-700 font-semibold">
              <Lock size={16} className="text-gray-400" aria-hidden="true" /> Not set
            </span>
            <p className="text-xs text-gray-400 mt-1">You signed in with Google or an OTP — use “Forgot password” on the login page to add one.</p>
          </div>
        )}
      </div>
    </div>
  </section>
);

export default ProfileInfo;
