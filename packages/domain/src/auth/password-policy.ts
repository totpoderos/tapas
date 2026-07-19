/** Why a password fails the policy (curriculum A07: 12+ chars, mixed case, number, symbol). */
export type PasswordWeakness =
  | 'TOO_SHORT'
  | 'MISSING_UPPERCASE'
  | 'MISSING_LOWERCASE'
  | 'MISSING_NUMBER'
  | 'MISSING_SYMBOL';

export const MIN_PASSWORD_LENGTH = 12;

/** Returns the first policy violation, or null if the password is strong enough. */
export function checkPasswordStrength(raw: string): PasswordWeakness | null {
  if (raw.length < MIN_PASSWORD_LENGTH) return 'TOO_SHORT';
  if (!/[A-Z]/.test(raw)) return 'MISSING_UPPERCASE';
  if (!/[a-z]/.test(raw)) return 'MISSING_LOWERCASE';
  if (!/[0-9]/.test(raw)) return 'MISSING_NUMBER';
  if (!/[^A-Za-z0-9]/.test(raw)) return 'MISSING_SYMBOL';
  return null;
}
