export type IssuePatResult = { readonly patId: string; readonly token: string };

export type RevokePatErrorCode = 'PAT_NOT_FOUND' | 'NOT_ALLOWED';

export interface RevokePatError {
  readonly code: RevokePatErrorCode;
  readonly message: string;
}

export type RevokePatResult =
  { readonly ok: true } | { readonly ok: false; readonly error: RevokePatError };
