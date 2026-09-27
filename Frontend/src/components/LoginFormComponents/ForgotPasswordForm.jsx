import { useRef } from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import PasswordInput from '../PasswordInput';
import Button from '../ui/Button';
import Input from '../ui/Input';

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

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return;
    if (digits.length === 1) {
      const newOtp = [...otp];
      newOtp[index] = digits;
      setOtp(newOtp);
      if (index < 5) inputRefs.current[index + 1]?.focus();
      return;
    }
    handleOtpPasteFallback(index, digits);
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const firstEmpty = otp.findIndex((d) => d === '');
    const start = firstEmpty === -1 ? 0 : firstEmpty;
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length && start + i <= 5; i++) {
      newOtp[start + i] = pasted[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(start + pasted.length, 5)]?.focus();
  };

  const handleOtpPasteFallback = (index, digits) => {
    const newOtp = [...otp];
    for (let i = 0; i < digits.length && index + i <= 5; i++) {
      newOtp[index + i] = digits[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

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
        <form onSubmit={handleSendResetOtp} aria-busy={loading} className="space-y-6">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-500 mb-6">Enter your email and we'll send you an OTP to reset your password.</p>
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-500" />
              <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="block w-full pl-10 pr-3 py-4 border-gray-200 rounded-xl font-medium bg-gray-50" placeholder="name@example.com" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Send Reset OTP'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} aria-busy={loading} className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Verify & Reset</h2>
            <p className="text-gray-500 text-sm mb-4">OTP sent to <span className="font-bold text-gray-800">{email}</span></p>
          </div>
          <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input key={index} ref={(el) => (inputRefs.current[index] = el)} type="text" inputMode="numeric" maxLength={1} autoComplete="one-time-code" aria-label={`Digit ${index + 1} of 6`} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-9 h-12 min-w-0 flex-1 sm:flex-none sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-extrabold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 bg-gray-50" />
            ))}
          </div>
          <div>
            <label htmlFor="forgot-new-password" className="block text-sm font-bold text-gray-700 mb-2 mt-4">New Password</label>
            <PasswordInput id="forgot-new-password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters, 1 upper, 1 lower, 1 number" required minLength="8" />
          </div>
          <Button type="submit" variant="dark" disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all shadow-md mt-2">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Save New Password'}
          </Button>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
