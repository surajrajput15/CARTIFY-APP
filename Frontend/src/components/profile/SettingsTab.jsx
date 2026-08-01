const SettingsTab = ({ onDeleteAccount }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
    <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">Account Settings</h2>
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
        <div>
          <h3 className="font-bold text-red-700 text-sm">Delete Account</h3>
          <p className="text-xs text-red-500 mt-1">Permanently remove your account and all associated data.</p>
        </div>
        <button onClick={onDeleteAccount} className="text-white font-bold text-sm bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-sm" aria-label="Delete your account permanently">
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default SettingsTab;
