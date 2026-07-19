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

export type AuthResult =
  | { readonly ok: true; readonly session: Session; readonly hostId: string; readonly role: string }
  | { readonly ok: false; readonly error: AuthError };
