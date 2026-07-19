import { describe, expect, it } from 'vitest';
import { checkPasswordStrength } from '../../../src/index.js';

describe('checkPasswordStrength', () => {
  it('accepts a strong password', () => {
    expect(checkPasswordStrength('Str0ng!Passw0rd')).toBeNull();
  });

  it('rejects a short password', () => {
    expect(checkPasswordStrength('Ab1!')).toBe('TOO_SHORT');
  });

  it('requires an uppercase letter', () => {
    expect(checkPasswordStrength('str0ng!passw0rd')).toBe('MISSING_UPPERCASE');
  });

  it('requires a number', () => {
    expect(checkPasswordStrength('Strong!Password')).toBe('MISSING_NUMBER');
  });

  it('requires a symbol', () => {
    expect(checkPasswordStrength('Str0ngPassw0rd')).toBe('MISSING_SYMBOL');
  });
});
