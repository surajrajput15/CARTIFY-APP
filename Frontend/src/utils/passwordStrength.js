export const evaluatePasswordStrength = (password) => {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  let score;
  if (password.length < 8) {
    score = 'weak';
  } else if (checks.hasUpper && checks.hasLower && checks.hasNumber && checks.hasSpecial) {
    score = 'strong';
  } else if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) {
    score = 'medium';
  } else {
    score = 'weak';
  }

  return { score, checks };
};
