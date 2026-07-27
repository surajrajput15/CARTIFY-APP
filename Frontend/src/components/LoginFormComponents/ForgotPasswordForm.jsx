import { useRef, useEffect } from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import PasswordInput from '../PasswordInput';

const ForgotPasswordForm = ({
  setIsForgotPassword,
  forgotStep, setForgotStep,
  email, setEmail,
  otp, setOtp,
  newPassword, setNewPassword,
  loading,
  handleSendResetOtp, handleResetPassword
}) => {
  const inputRefs = useRef([]);
  const resetPasswordRef = useRef(handleResetPassword);

  useEffect(() => {
    resetPasswordRef.current = handleResetPassword;
  });

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value !== '' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (forgotStep === 2 && otp.every(d => d !== '') && newPassword.length >= 6) {
      const timer = setTimeout(() => {
        resetPasswordRef.current(new Event('submit'));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [otp, newPassword, forgotStep]);

  const handleBack = () => {
    setIsForgotPassword(false);
    setForgotStep(1);
  };

  return (
    <div className="animate-fade-in-up">
      <button onClick={handleBack} className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Back to Login
      </button>

      {forgotStep === 1 ? (
        <form onSubmit={handleSendResetOtp} className="space-y-6">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-500 mb-6">Enter your email and we'll send you an OTP to reset your password.</p>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 pr-3 py-4 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50" placeholder="name@example.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Send Reset OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Verify & Reset</h2>
            <p className="text-gray-500 text-sm mb-4">OTP sent to <span className="font-bold text-gray-800">{email}</span></p>
          </div>
          <div className="flex justify-between gap-1 sm:gap-2">
            {otp.map((digit, index) => (
              <input key={index} ref={(el) => (inputRefs.current[index] = el)} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-10 h-12 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-extrabold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 bg-gray-50" />
            ))}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 mt-4">New Password</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required minLength="6" />
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-md mt-2">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Save New Password'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
