import { useState } from 'react';
import { Eye, EyeOff, Loader2, Check, Lock, ShieldCheck, Trash2, LogOut, Info } from 'lucide-react';
import { validatePasswordPolicy } from '../../utils/format';

const PASSWORD_FIELD_CLASS =
  'block w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50 min-h-[44px]';

const Field = ({ id, label, value, onChange, autoComplete, placeholder, autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={PASSWORD_FIELD_CLASS}
          maxLength={128}
        />
        <button
          type="button"
          onClick={() => setShow(prev => !prev)}
          className="absolute inset-y-0 right-1 flex items-center px-2 text-gray-400 hover:text-gray-600 rounded-lg min-w-[44px] min-h-[44px]"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

const SettingsTab = ({ user, onDeleteAccount, onLogout, onChangePassword, changing }) => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const toggleChangePassword = () => {
    resetForm();
    setShowChangePassword(prev => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (changing) return;

    if (!currentPassword) return setError('Please enter your current password.');
    if (!newPassword || !confirmPassword) return setError('Please enter and confirm your new password.');
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) return setError(policyError);
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');
    if (newPassword === currentPassword) return setError('The new password must be different from the current one.');

    setError('');
    const success = await onChangePassword(currentPassword, newPassword);
    if (success) {
      resetForm();
      setShowChangePassword(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* ── SECURITY ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8" aria-labelledby="settings-security-heading">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-teal-600" aria-hidden="true" />
          <h2 id="settings-security-heading" className="text-lg sm:text-xl font-bold text-gray-800">Security</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Manage your password and account access.</p>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Lock size={14} className="text-gray-400" aria-hidden="true" /> Password
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {user?.hasPassword
                  ? 'Change it regularly to keep your account secure.'
                  : 'Your account has no password (Google/OTP sign-in). Use “Forgot password” on the login page to set one.'}
              </p>
            </div>
            {user?.hasPassword && (
              <button
                onClick={toggleChangePassword}
                aria-expanded={showChangePassword}
                aria-controls="change-password-form"
                className="flex-shrink-0 text-white font-bold text-sm bg-teal-600 px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors shadow-sm min-h-[44px]"
              >
                {showChangePassword ? 'Hide' : 'Change Password'}
              </button>
            )}
          </div>

          {user?.hasPassword && showChangePassword && (
            <form id="change-password-form" onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
              <Field
                id="current-password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your current password"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, upper + lower + number"
                />
                <Field
                  id="confirm-password"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter the new password"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={toggleChangePassword}
                  disabled={changing}
                  className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changing}
                  className="bg-teal-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                >
                  {changing ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                  {changing ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
      {/* ── ACCOUNT ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading" className="text-lg sm:text-xl font-bold text-gray-800 mb-1">Account</h2>
        <p className="text-sm text-gray-500 mb-4">Your identity and membership details.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Email</h3>
            <p className="text-sm font-semibold text-gray-800 mt-1 break-all" title={user?.email}>{user?.email || 'Not set'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Member Since</h3>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
          <div>
            <h3 className="font-bold text-red-700 text-sm">Delete Account</h3>
            <p className="text-xs text-red-500 mt-1">Permanently remove your account, orders, addresses and cart. This cannot be undone.</p>
          </div>
          <button
            onClick={onDeleteAccount}
            className="flex-shrink-0 flex items-center justify-center gap-2 text-white font-bold text-sm bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-sm min-h-[44px]"
            aria-label="Delete your account permanently"
          >
            <Trash2 size={16} aria-hidden="true" /> Delete
          </button>
        </div>
      </section>

      {/* ── SESSION ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8" aria-labelledby="settings-session-heading">
        <div className="flex items-center gap-2 mb-1">
          <LogOut size={20} className="text-teal-600" aria-hidden="true" />
          <h2 id="settings-session-heading" className="text-lg sm:text-xl font-bold text-gray-800">Session</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500 flex items-start gap-2">
            <Info size={16} className="text-gray-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Sign out on this device. You can always log back in later.
          </p>
          <button
            onClick={onLogout}
            className="flex-shrink-0 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px]"
            aria-label="Log out of your account"
          >
            <LogOut size={16} aria-hidden="true" /> Log Out
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsTab;
