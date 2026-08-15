import { describe, it, expect } from 'vitest';
import { evaluatePasswordStrength } from './passwordStrength';

describe('evaluatePasswordStrength', () => {
  it('returns weak for short passwords', () => {
    const { score } = evaluatePasswordStrength('Ab1!');
    expect(score).toBe('weak');
  });

  it('returns strong for a password with all character classes and length >= 8', () => {
    const { score, checks } = evaluatePasswordStrength('Abcd1234!');
    expect(score).toBe('strong');
    expect(checks).toMatchObject({
      minLength: true,
      hasUpper: true,
      hasLower: true,
      hasNumber: true,
      hasSpecial: true,
    });
  });

  it('returns medium for letters + digits without special char', () => {
    const { score } = evaluatePasswordStrength('Abcd1234');
    expect(score).toBe('medium');
  });

  it('returns weak for letters only', () => {
    const { score } = evaluatePasswordStrength('Abcdefgh');
    expect(score).toBe('weak');
  });
});