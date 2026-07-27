import { useState, useCallback } from 'react';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PasswordLoginForm from '../components/LoginFormComponents/PasswordLoginForm';
import OTPLoginForm from '../components/LoginFormComponents/OTPLoginForm';
import ForgotPasswordForm from '../components/LoginFormComponents/ForgotPasswordForm';
import GoogleLoginButton from '../components/LoginFormComponents/GoogleLoginButton';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginMethod, setLoginMethod] = useState('otp');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendResetOtp = useCallback(async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccessMsg('Reset OTP sent to your email!');
      setForgotStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) return setError('Please enter all 6 digits.');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');

    setError(''); setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { email, otp: otpValue, newPassword });
      setSuccessMsg('Password reset successful!');

      setIsForgotPassword(false);
      setForgotStep(1);
      setOtp(['', '', '', '', '', '']);
      setPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP or expired.');
    } finally {
      setLoading(false);
    }
  }, [email, otp, newPassword]);

  const handleSendOtp = useCallback(async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      await api.post('/api/auth/send-otp', { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) return setError('Please enter all 6 digits.');
    setError(''); setLoading(true);
    try {
      const response = await api.post('/api/auth/verify-otp', { email, otp: otpValue });
      login(response.data.user, response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  }, [email, otp, login, navigate]);

  const handlePasswordAuth = useCallback(async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      if (isRegistering) {
        await api.post('/api/auth/register', { name, email, password });
        setSuccessMsg('Account created successfully! Please log in.');
        setIsRegistering(false);
        setPassword('');
      } else {
        const response = await api.post('/api/auth/login', { email, password });
        login(response.data.user, response.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }, [isRegistering, name, email, password, login, navigate]);

  const switchMode = (mode) => {
    setLoginMethod(mode); setError(''); setSuccessMsg(''); setIsForgotPassword(false); setStep(1); setForgotStep(1);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100">

        {!isForgotPassword && step === 1 && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button
              onClick={() => switchMode('otp')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMethod === 'otp' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Login with OTP
            </button>
            <button
              onClick={() => switchMode('password')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${loginMethod === 'password' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Email & Password
            </button>
          </div>
        )}

        {error && <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm font-medium animate-fade-in-up">{error}</div>}
        {successMsg && <div role="alert" className="mb-6 p-3 bg-green-50 border border-green-100 text-green-600 rounded-lg text-sm font-medium animate-fade-in-up">{successMsg}</div>}

        {isForgotPassword && (
          <ForgotPasswordForm
            setIsForgotPassword={setIsForgotPassword}
            forgotStep={forgotStep}
            setForgotStep={setForgotStep}
            email={email}
            setEmail={setEmail}
            otp={otp}
            setOtp={setOtp}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            loading={loading}
            handleSendResetOtp={handleSendResetOtp}
            handleResetPassword={handleResetPassword}
          />
        )}

        {!isForgotPassword && loginMethod === 'otp' && (
          <OTPLoginForm
            step={step}
            setStep={setStep}
            email={email}
            setEmail={setEmail}
            otp={otp}
            setOtp={setOtp}
            loading={loading}
            handleSendOtp={handleSendOtp}
            handleVerifyOtp={handleVerifyOtp}
          />
        )}

        {!isForgotPassword && loginMethod === 'password' && (
          <PasswordLoginForm
            isRegistering={isRegistering}
            setIsRegistering={setIsRegistering}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            handlePasswordAuth={handlePasswordAuth}
            setIsForgotPassword={setIsForgotPassword}
            setError={setError}
            setSuccessMsg={setSuccessMsg}
          />
        )}

        {!isForgotPassword && (
          <GoogleLoginButton login={login} navigate={navigate} setError={setError} />
        )}

      </div>
    </div>
  );
};

export default LoginPage;
