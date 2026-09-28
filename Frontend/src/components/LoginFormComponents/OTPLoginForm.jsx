import { useEffect, useRef } from 'react';
import { Mail, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

const OTPLoginForm = ({
  step, setStep,
  email, setEmail,
  otp, setOtp,
  loading,
  handleSendOtp, handleVerifyOtp,
  forwardRef
}) => {
  const inputRefs = useRef([]);
  const formRef = useRef(null);

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
    // Multi-digit value (defensive — the onPaste handler normally covers paste)
    handleOtpPasteFallback(index, digits);
  };

  // Paste a (partial) code anywhere in the row: spread it across the remaining
  // slots and focus the slot after the last filled one.
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

  useEffect(() => {
    if (step === 2 && forwardRef) {
      forwardRef.current = { otpInputRefs: inputRefs.current };
    }
  }, [step, forwardRef]);

  useEffect(() => {
    if (step === 2 && otp.every(d => d !== '')) {
      const timer = setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [otp, step]);

  return (
    <div>
      {step === 1 ? (
        <form onSubmit={handleSendOtp} aria-busy={loading} className="space-y-6 animate-fade-in-up">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Instant Login</h2>
          <p className="text-gray-500 mb-6">Enter your email to receive a 6-digit secure code.</p>
          <div>
            <label htmlFor="otp-email" className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-500" aria-hidden="true" />
              <Input id="otp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="block w-full pl-10 pr-3 py-4 border-gray-200 rounded-xl font-medium bg-gray-50" placeholder="e.g. name@example.com" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} aria-hidden="true" /> : 'Get OTP'} {!loading && <ArrowRight size={20} aria-hidden="true" />}
          </Button>
        </form>
      ) : (
        <form ref={formRef} onSubmit={handleVerifyOtp} aria-busy={loading} className="space-y-8 animate-fade-in-up">
          <button type="button" onClick={() => setStep(1)} className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft size={16} className="mr-1" aria-hidden="true" /> Change Email
          </button>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Enter OTP</h2>
            <p className="text-gray-500 mb-6">Sent to <span className="font-bold text-gray-800">{email}</span></p>
          </div>
          <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input key={index} ref={(el) => (inputRefs.current[index] = el)} type="text" inputMode="numeric" maxLength={1} autoComplete="one-time-code" aria-label={`Digit ${index + 1} of 6`} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-9 h-12 min-w-0 flex-1 sm:flex-none sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-extrabold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 bg-gray-50" />
            ))}
          </div>
          <Button type="submit" variant="dark" disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} aria-hidden="true" /> : 'Verify & Login'} {!loading && <ShieldCheck size={20} aria-hidden="true" />}
          </Button>
        </form>
      )}
    </div>
  );
};

export default OTPLoginForm;
