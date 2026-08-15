import { Mail, User as UserIcon, Loader2, ShieldCheck } from 'lucide-react';
import PasswordInput from '../PasswordInput';
import PasswordStrengthMeter from '../PasswordStrengthMeter';

const PasswordLoginForm = ({
  isRegistering, setIsRegistering,
  name, setName,
  email, setEmail,
  password, setPassword,
  loading, handlePasswordAuth,
  setIsForgotPassword, setError, setSuccessMsg,
  claimMode, claimOtp, setClaimOtp, claimOtpSent, onClaimSendOtp, onClaimSubmit
}) => {
  return (
    <form onSubmit={handlePasswordAuth} className="space-y-5 animate-fade-in-up">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
        {isRegistering ? 'Create Account' : 'Welcome Back'}
      </h2>
      <p className="text-gray-500 mb-6">
        {isRegistering ? 'Join us for a premium shopping experience.' : 'Enter your credentials to access your account.'}
      </p>

      {isRegistering && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
          <div className="relative">
            <UserIcon className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-400" />
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="block w-full pl-10 pr-3 py-4 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50" placeholder="John Doe" />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-400" />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 pr-3 py-4 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50" placeholder="name@example.com" />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-bold text-gray-700">Password</label>
          {!isRegistering && (
            <button type="button" onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }} className="text-sm font-bold text-teal-600 hover:text-teal-700">
              Forgot Password?
            </button>
          )}
        </div>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength="8" />
        {isRegistering && <PasswordStrengthMeter password={password} />}
      </div>

      <button type="submit" disabled={loading} className="w-full flex items-center justify-center bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-md mt-4">
        {loading ? <Loader2 className="animate-spin" size={24} /> : (isRegistering ? 'Sign Up' : 'Login')}
      </button>

      {claimMode && isRegistering && (
        <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="text-teal-600 mt-0.5 shrink-0" size={18} aria-hidden="true" />
            <p className="text-sm text-gray-700">
              This email already has an OTP login account. Verify you own it by entering the OTP to set your password.
            </p>
          </div>

          {claimOtpSent && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength="6"
              placeholder="Enter 6-digit OTP"
              value={claimOtp}
              onChange={(e) => setClaimOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-white"
              aria-label="Claim account OTP"
            />
          )}

          <div className="flex gap-2">
            {claimOtpSent ? (
              <button
                type="button"
                onClick={onClaimSubmit}
                disabled={loading}
                className="flex-1 bg-teal-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin inline" size={18} /> : 'Claim & Set Password'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClaimSendOtp}
                disabled={loading}
                className="flex-1 bg-teal-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin inline" size={18} /> : 'Send OTP to My Email'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="text-center mt-6">
        <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMsg(''); }} className="text-sm font-bold text-teal-600 hover:text-teal-700">
          {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign up"}
        </button>
      </div>
    </form>
  );
};

export default PasswordLoginForm;
