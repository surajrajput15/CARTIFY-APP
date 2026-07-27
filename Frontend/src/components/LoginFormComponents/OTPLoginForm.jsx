import { useEffect, useRef } from 'react';
import { Mail, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';

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
        <form onSubmit={handleSendOtp} className="space-y-6 animate-fade-in-up">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Instant Login</h2>
          <p className="text-gray-500 mb-6">Enter your email to receive a 6-digit secure code.</p>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 pr-3 py-4 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50" placeholder="e.g. name@example.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Get OTP'} {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      ) : (
        <form ref={formRef} onSubmit={handleVerifyOtp} className="space-y-8 animate-fade-in-up">
          <button type="button" onClick={() => setStep(1)} className="flex items-center text-sm font-bold text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft size={16} className="mr-1" /> Change Email
          </button>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Enter OTP</h2>
            <p className="text-gray-500 mb-6">Sent to <span className="font-bold text-gray-800">{email}</span></p>
          </div>
          <div className="flex justify-between gap-1 sm:gap-2">
            {otp.map((digit, index) => (
              <input key={index} ref={(el) => (inputRefs.current[index] = el)} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index, e)} className="w-10 h-12 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-extrabold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-0 bg-gray-50" />
            ))}
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-md">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'Verify & Login'} {!loading && <ShieldCheck size={20} />}
          </button>
        </form>
      )}
    </div>
  );
};

export default OTPLoginForm;
