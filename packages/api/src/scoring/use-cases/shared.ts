import type { ScoreCheckErrorCode } from '@tapas/domain';
import type { StoredScore } from '../stored-vote-session.js';

export type SaveScoreErrorCode = ScoreCheckErrorCode | 'CONTEST_NOT_FOUND';

export interface SaveScoreError {
  readonly code: SaveScoreErrorCode;
  readonly message: string;
}

export type SaveScoreResult =
  | { readonly ok: true; readonly score: StoredScore }
  | { readonly ok: false; readonly error: SaveScoreError };
