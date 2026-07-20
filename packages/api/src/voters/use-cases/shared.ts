import type { Session } from '../../auth/token-issuer.js';

export type ClaimErrorCode = 'JOIN_CODE_NOT_FOUND' | 'NO_SUCH_PLACE' | 'PLACE_TAKEN';

export interface ClaimError {
  readonly code: ClaimErrorCode;
  readonly message: string;
}

export type ClaimResult =
  | {
      readonly ok: true;
      readonly session: Session;
      readonly contestId: string;
      readonly participantId: string;
      readonly displayName: string;
    }
  | { readonly ok: false; readonly error: ClaimError };
