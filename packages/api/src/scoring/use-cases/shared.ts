import type { ScoreCheckErrorCode, VoteSessionErrorCode } from '@tapas/domain';
import type { StoredScore, StoredVoteSession } from '../stored-vote-session.js';

export type SaveScoreErrorCode =
  | ScoreCheckErrorCode
  | 'CONTEST_NOT_FOUND'
  | 'SESSION_LOCKED'
  | 'CONTEST_CLOSED';

export interface SaveScoreError {
  readonly code: SaveScoreErrorCode;
  readonly message: string;
}

export type SaveScoreResult =
  | { readonly ok: true; readonly score: StoredScore }
  | { readonly ok: false; readonly error: SaveScoreError };

export type SendVoteErrorCode =
  | VoteSessionErrorCode
  | 'CONTEST_NOT_FOUND'
  | 'NO_VOTE_SESSION'
  | 'CONTEST_CLOSED';

export interface SendVoteError {
  readonly code: SendVoteErrorCode;
  readonly message: string;
}

export type SendVoteResult =
  | { readonly ok: true; readonly session: StoredVoteSession }
  | { readonly ok: false; readonly error: SendVoteError };
