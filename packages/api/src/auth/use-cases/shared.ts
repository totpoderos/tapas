import type { Session } from '../token-issuer.js';

export type RegisterErrorCode = 'INVALID_EMAIL' | 'WEAK_PASSWORD' | 'EMAIL_TAKEN';

export interface RegisterError {
  readonly code: RegisterErrorCode;
  readonly message: string;
}

export type RegisterResult =
  | { readonly ok: true; readonly hostId: string }
  | { readonly ok: false; readonly error: RegisterError };

export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED';

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

/**
 * Internal-only refusal reason for the security log. Distinct from the
 * client-facing `AuthError.code`, which stays generic (`INVALID_CREDENTIALS`)
 * for both a wrong password and an unknown account — no enumeration to the
 * caller, full truth to the forensic log.
 */
export type AuthLogReason = 'unknown_account' | 'bad_password' | 'account_locked';

export type AuthResult =
  | { readonly ok: true; readonly session: Session; readonly hostId: string; readonly role: string }
  | {
      readonly ok: false;
      readonly error: AuthError;
      readonly logReason: AuthLogReason;
      /** The account id when the account was found (a wrong-password or locked attempt); null for an unknown account. */
      readonly hostId: string | null;
    };

export type RefreshErrorCode = 'NOT_SIGNED_IN';

export interface RefreshError {
  readonly code: RefreshErrorCode;
  readonly message: string;
}

export type RefreshResult =
  | { readonly ok: true; readonly session: Session; readonly hostId: string; readonly role: string }
  | { readonly ok: false; readonly error: RefreshError };
