import { Edit2, X, Loader2, Check } from 'lucide-react';

const ProfileInfo = ({ user, isEditing, editName, updateLoading, onToggleEdit, onEditNameChange, onSave }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
      <h2 className="text-xl font-bold text-gray-800">Personal Information</h2>
      {!isEditing ? (
        <button onClick={onToggleEdit} className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700">
          <Edit2 size={16} aria-hidden="true" /> Edit Profile
        </button>
      ) : (
        <button onClick={onToggleEdit} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700">
          <X size={16} aria-hidden="true" /> Cancel
        </button>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-2">Full Name</label>
        {isEditing ? (
          <div className="flex gap-2">
            <input type="text" value={editName} onChange={onEditNameChange} className="w-full px-4 py-2 rounded-lg border border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium" />
            <button onClick={onSave} disabled={updateLoading} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center justify-center min-w-[48px]">
              {updateLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">{user.name}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-2">Email Address (Cannot be changed)</label>
        <p className="text-gray-500 font-medium bg-gray-100 p-3 rounded-lg border border-gray-200 cursor-not-allowed">{user.email}</p>
      </div>
    </div>
  </div>
);

export default ProfileInfo;
