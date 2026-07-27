import { evaluatePasswordStrength } from '../utils/passwordStrength';

const checklistItems = [
  { key: 'minLength', label: 'Minimum 8 characters' },
  { key: 'hasUpper', label: 'Uppercase letter' },
  { key: 'hasLower', label: 'Lowercase letter' },
  { key: 'hasNumber', label: 'Number' },
  { key: 'hasSpecial', label: 'Special character' },
];

const strengthConfig = {
  weak: { label: 'Weak', color: 'bg-red-500', textColor: 'text-red-600', barWidth: '33%' },
  medium: { label: 'Medium', color: 'bg-yellow-400', textColor: 'text-yellow-600', barWidth: '66%' },
  strong: { label: 'Strong', color: 'bg-green-500', textColor: 'text-green-600', barWidth: '100%' },
};

const PasswordStrengthMeter = ({ password }) => {
  if (!password) return null;

  const { score, checks } = evaluatePasswordStrength(password);
  const config = strengthConfig[score];

  return (
    <div className="mt-3 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${config.textColor}`}>
          <span className="mr-1" aria-hidden="true">&#9679;</span>
          {config.label}
        </span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${config.color}`}
          style={{ width: config.barWidth }}
          role="progressbar"
          aria-valuenow={score === 'weak' ? 33 : score === 'medium' ? 66 : 100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Password strength: ${config.label}`}
        />
      </div>

      <ul className="space-y-1">
        {checklistItems.map((item) => {
          const passed = checks[item.key];
          return (
            <li key={item.key} className={`flex items-center gap-2 text-xs font-medium ${passed ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`text-sm font-bold ${passed ? 'text-green-500' : 'text-gray-300'}`}>
                {passed ? '\u2713' : '\u2717'}
              </span>
              {item.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
