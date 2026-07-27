import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

const PasswordInput = ({ value, onChange, placeholder, className = '', ...rest }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute inset-y-0 left-3 top-4 h-5 w-5 text-gray-400" aria-hidden="true" />
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`block w-full pl-10 pr-12 py-4 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium bg-gray-50 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShowPassword(prev => !prev)}
        className="absolute inset-y-0 right-3 top-4 h-5 w-5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded transition-colors"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

export default PasswordInput;
