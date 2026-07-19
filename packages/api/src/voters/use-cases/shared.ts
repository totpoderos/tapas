import type { Session } from '../../auth/token-issuer.js';

export type JoinErrorCode = 'JOIN_CODE_NOT_FOUND';

export interface JoinError {
  readonly code: JoinErrorCode;
  readonly message: string;
}

export type JoinResult =
  | { readonly ok: true; readonly session: Session; readonly voterId: string; readonly contestId: string }
  | { readonly ok: false; readonly error: JoinError };
